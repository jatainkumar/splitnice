from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from typing import List
from decimal import Decimal
from collections import defaultdict

from app.database import get_db
from app.models import User, Group, GroupMember, Balance
from app.firebase_auth import get_current_user_uid

router = APIRouter()


class BalanceEntry(BaseModel):
    from_user_id: str
    from_user_name: str
    to_user_id: str
    to_user_name: str
    amount: float


class GroupBalanceResponse(BaseModel):
    group_id: str
    group_name: str
    balances: List[BalanceEntry]
    simplified_balances: List[BalanceEntry]


class UserBalanceSummary(BaseModel):
    total_owed: float  # Money others owe you
    total_owing: float  # Money you owe others
    net_balance: float
    by_group: List[GroupBalanceResponse]


def _simplify_debts(balances: List[dict]) -> List[dict]:
    """Simplify debts using the minimum cash flow algorithm."""
    # Build net balance for each user
    net = defaultdict(float)
    for b in balances:
        net[b["from_user_id"]] -= b["amount"]
        net[b["to_user_id"]] += b["amount"]

    # Collect user names
    user_names = {}
    for b in balances:
        user_names[b["from_user_id"]] = b["from_user_name"]
        user_names[b["to_user_id"]] = b["to_user_name"]

    # Separate into creditors and debtors
    creditors = []
    debtors = []
    for uid, amount in net.items():
        if amount > 0.01:
            creditors.append({"id": uid, "amount": amount})
        elif amount < -0.01:
            debtors.append({"id": uid, "amount": -amount})

    # Sort for greedy matching
    creditors.sort(key=lambda x: x["amount"], reverse=True)
    debtors.sort(key=lambda x: x["amount"], reverse=True)

    simplified = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        debtor = debtors[i]
        creditor = creditors[j]
        transfer = min(debtor["amount"], creditor["amount"])

        if transfer > 0.01:
            simplified.append({
                "from_user_id": debtor["id"],
                "from_user_name": user_names.get(debtor["id"], "Unknown"),
                "to_user_id": creditor["id"],
                "to_user_name": user_names.get(creditor["id"], "Unknown"),
                "amount": round(transfer, 2),
            })

        debtor["amount"] -= transfer
        creditor["amount"] -= transfer

        if debtor["amount"] < 0.01:
            i += 1
        if creditor["amount"] < 0.01:
            j += 1

    return simplified


async def _get_current_user(firebase_uid: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/group/{group_id}", response_model=GroupBalanceResponse)
async def get_group_balances(
    group_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Get balances for a group, both raw and simplified."""
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    result = await db.execute(
        select(Balance, User)
        .join(User, Balance.from_user_id == User.id)
        .where(Balance.group_id == group_id, Balance.amount > 0.01)
    )
    raw_balances = []
    balance_dicts = []
    for balance, from_user in result.all():
        to_result = await db.execute(select(User).where(User.id == balance.to_user_id))
        to_user = to_result.scalar_one()
        entry = {
            "from_user_id": str(balance.from_user_id),
            "from_user_name": from_user.name,
            "to_user_id": str(balance.to_user_id),
            "to_user_name": to_user.name,
            "amount": round(float(balance.amount), 2),
        }
        balance_dicts.append(entry)
        raw_balances.append(BalanceEntry(**entry))

    simplified = _simplify_debts(balance_dicts)
    simplified_balances = [BalanceEntry(**s) for s in simplified]

    return GroupBalanceResponse(
        group_id=str(group.id),
        group_name=group.name,
        balances=raw_balances,
        simplified_balances=simplified_balances,
    )


@router.get("/me", response_model=UserBalanceSummary)
async def get_my_balances(
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Get overall balance summary across all groups."""
    user = await _get_current_user(firebase_uid, db)

    # Get all groups the user is in
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.user_id == user.id,
            GroupMember.invite_status == "accepted",
        )
    )
    memberships = result.scalars().all()

    total_owed = 0.0
    total_owing = 0.0
    by_group = []

    for membership in memberships:
        group_result = await db.execute(select(Group).where(Group.id == membership.group_id))
        group = group_result.scalar_one_or_none()
        if not group or group.is_archived:
            continue

        # Get balances where user is creditor (others owe user)
        result = await db.execute(
            select(Balance).where(
                Balance.group_id == group.id,
                Balance.to_user_id == user.id,
                Balance.amount > 0.01,
            )
        )
        for b in result.scalars().all():
            total_owed += float(b.amount)

        # Get balances where user is debtor (user owes others)
        result = await db.execute(
            select(Balance).where(
                Balance.group_id == group.id,
                Balance.from_user_id == user.id,
                Balance.amount > 0.01,
            )
        )
        for b in result.scalars().all():
            total_owing += float(b.amount)

        # Build group balance response
        group_balance_result = await db.execute(
            select(Balance).where(
                Balance.group_id == group.id,
                Balance.amount > 0.01,
            )
        )
        all_balances = group_balance_result.scalars().all()
        balance_dicts = []
        raw_balances = []
        for b in all_balances:
            from_result = await db.execute(select(User).where(User.id == b.from_user_id))
            from_user = from_result.scalar_one()
            to_result = await db.execute(select(User).where(User.id == b.to_user_id))
            to_user = to_result.scalar_one()
            entry = {
                "from_user_id": str(b.from_user_id),
                "from_user_name": from_user.name,
                "to_user_id": str(b.to_user_id),
                "to_user_name": to_user.name,
                "amount": round(float(b.amount), 2),
            }
            balance_dicts.append(entry)
            raw_balances.append(BalanceEntry(**entry))

        simplified = _simplify_debts(balance_dicts)
        simplified_balances = [BalanceEntry(**s) for s in simplified]

        if raw_balances:
            by_group.append(GroupBalanceResponse(
                group_id=str(group.id),
                group_name=group.name,
                balances=raw_balances,
                simplified_balances=simplified_balances,
            ))

    return UserBalanceSummary(
        total_owed=round(total_owed, 2),
        total_owing=round(total_owing, 2),
        net_balance=round(total_owed - total_owing, 2),
        by_group=by_group,
    )
