from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models import (
    User, Group, GroupMember, Expense, ExpensePayer, ExpenseSplit,
    Balance, Notification, ChatMessage
)
from app.firebase_auth import get_current_user_uid
from app.websocket_manager import manager
import asyncio
from app.email_service import send_email_async

router = APIRouter()


class PayerInput(BaseModel):
    user_id: str
    amount_paid: float


class SplitInput(BaseModel):
    user_id: str
    value: float  # amount for unequal, percentage for %, shares for ratio


class ExpenseCreateRequest(BaseModel):
    group_id: str
    description: Optional[str] = None
    total_amount: float
    currency: str = "INR"
    exchange_rate: Optional[float] = None
    split_type: str  # 'equal', 'unequal', 'percentage', 'share'
    payers: List[PayerInput]
    splits: List[SplitInput]
    receipt_image: Optional[str] = None  # Base64


class ExpenseUpdateRequest(BaseModel):
    description: Optional[str] = None
    total_amount: Optional[float] = None
    split_type: Optional[str] = None
    payers: Optional[List[PayerInput]] = None
    splits: Optional[List[SplitInput]] = None


class PayerResponse(BaseModel):
    user_id: str
    user_name: str
    amount_paid: float


class SplitResponse(BaseModel):
    user_id: str
    user_name: str
    owed_amount: float


class ExpenseResponse(BaseModel):
    id: str
    group_id: str
    description: Optional[str] = None
    total_amount: float
    currency: str
    exchange_rate: Optional[float] = None
    split_type: str
    created_by: str
    creator_name: str
    payers: List[PayerResponse]
    splits: List[SplitResponse]
    receipt_image: Optional[str] = None
    created_at: str
    can_edit: bool
    can_delete: bool


async def _get_current_user(firebase_uid: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _calculate_splits(total_amount: float, split_type: str, splits: List[SplitInput]) -> dict:
    """Calculate the owed amount for each user based on split type."""
    result = {}
    total = Decimal(str(total_amount))

    if split_type == "equal":
        per_person = total / len(splits)
        for s in splits:
            result[s.user_id] = float(round(per_person, 2))
        # Handle rounding remainder
        diff = float(total) - sum(result.values())
        if diff != 0 and splits:
            result[splits[0].user_id] = round(result[splits[0].user_id] + diff, 2)

    elif split_type == "unequal":
        for s in splits:
            result[s.user_id] = round(s.value, 2)

    elif split_type == "percentage":
        for s in splits:
            amount = float(total) * s.value / 100
            result[s.user_id] = round(amount, 2)
        diff = float(total) - sum(result.values())
        if diff != 0 and splits:
            result[splits[0].user_id] = round(result[splits[0].user_id] + diff, 2)

    elif split_type == "share":
        total_shares = sum(s.value for s in splits)
        if total_shares == 0:
            raise HTTPException(status_code=400, detail="Total shares cannot be zero")
        for s in splits:
            amount = float(total) * s.value / total_shares
            result[s.user_id] = round(amount, 2)
        diff = float(total) - sum(result.values())
        if diff != 0 and splits:
            result[splits[0].user_id] = round(result[splits[0].user_id] + diff, 2)

    return result


async def _update_balances(group_id: str, payers_data: dict, splits_data: dict, db: AsyncSession, subtract=False):
    """Update pairwise balances based on expense payers and splits."""
    multiplier = -1 if subtract else 1

    # For each split participant, calculate net against each payer
    all_users = set(list(payers_data.keys()) + list(splits_data.keys()))

    # Net amount for each user: positive = they paid more than they owe
    net = {}
    for uid in all_users:
        paid = payers_data.get(uid, 0)
        owed = splits_data.get(uid, 0)
        net[uid] = paid - owed

    # Create pairwise debts: if user A has net > 0 and user B has net < 0,
    # B owes A some amount
    creditors = [(uid, amt) for uid, amt in net.items() if amt > 0]
    debtors = [(uid, -amt) for uid, amt in net.items() if amt < 0]

    for debtor_id, debt_amount in debtors:
        remaining = debt_amount
        for i, (creditor_id, credit_amount) in enumerate(creditors):
            if remaining <= 0 or credit_amount <= 0:
                continue
            transfer = min(remaining, credit_amount)

            # Update balance: debtor owes creditor
            result = await db.execute(
                select(Balance).where(
                    Balance.group_id == group_id,
                    Balance.from_user_id == debtor_id,
                    Balance.to_user_id == creditor_id,
                )
            )
            balance = result.scalar_one_or_none()

            if balance:
                balance.amount = float(balance.amount) + (transfer * multiplier)
            else:
                if not subtract:
                    balance = Balance(
                        group_id=group_id,
                        from_user_id=debtor_id,
                        to_user_id=creditor_id,
                        amount=transfer,
                    )
                    db.add(balance)

            remaining -= transfer
            creditors[i] = (creditor_id, credit_amount - transfer)

    await db.flush()


async def _build_expense_response(expense: Expense, db: AsyncSession) -> ExpenseResponse:
    # Get creator
    result = await db.execute(select(User).where(User.id == expense.created_by))
    creator = result.scalar_one()

    # Get payers
    result = await db.execute(
        select(ExpensePayer, User)
        .join(User, ExpensePayer.user_id == User.id)
        .where(ExpensePayer.expense_id == expense.id)
    )
    payers = [
        PayerResponse(user_id=str(ep.user_id), user_name=u.name, amount_paid=float(ep.amount_paid))
        for ep, u in result.all()
    ]

    # Get splits
    result = await db.execute(
        select(ExpenseSplit, User)
        .join(User, ExpenseSplit.user_id == User.id)
        .where(ExpenseSplit.expense_id == expense.id)
    )
    splits = [
        SplitResponse(user_id=str(es.user_id), user_name=u.name, owed_amount=float(es.owed_amount))
        for es, u in result.all()
    ]

    now = datetime.now(timezone.utc)
    can_edit = (now - expense.created_at) < timedelta(minutes=30)

    return ExpenseResponse(
        id=str(expense.id),
        group_id=str(expense.group_id),
        description=expense.description,
        total_amount=float(expense.total_amount),
        currency=expense.currency,
        exchange_rate=float(expense.exchange_rate) if expense.exchange_rate else None,
        split_type=expense.split_type,
        created_by=str(expense.created_by),
        creator_name=creator.name,
        payers=payers,
        splits=splits,
        receipt_image=expense.receipt_image,
        created_at=expense.created_at.isoformat(),
        can_edit=can_edit,
        can_delete=can_edit,
    )


@router.post("", response_model=ExpenseResponse)
async def create_expense(
    request: ExpenseCreateRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Create a new expense."""
    user = await _get_current_user(firebase_uid, db)

    # Verify group membership
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == request.group_id,
            GroupMember.user_id == user.id,
            GroupMember.invite_status == "accepted",
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not an accepted member of this group")

    # Validate payers total matches expense total
    payer_total = sum(p.amount_paid for p in request.payers)
    if abs(payer_total - request.total_amount) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Payer total ({payer_total}) does not match expense total ({request.total_amount})"
        )

    # Calculate effective amount in INR
    effective_amount = request.total_amount
    if request.currency != "INR" and request.exchange_rate:
        effective_amount = request.total_amount * request.exchange_rate

    # Calculate splits
    splits_data = _calculate_splits(effective_amount, request.split_type, request.splits)

    # Validate unequal splits
    if request.split_type == "unequal":
        split_total = sum(s.value for s in request.splits)
        if abs(split_total - effective_amount) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Split total ({split_total}) does not match expense amount ({effective_amount})"
            )

    # Validate percentage splits
    if request.split_type == "percentage":
        pct_total = sum(s.value for s in request.splits)
        if abs(pct_total - 100) > 0.01:
            raise HTTPException(status_code=400, detail="Percentages must sum to 100")

    # Create expense
    expense = Expense(
        group_id=request.group_id,
        description=request.description,
        total_amount=effective_amount,
        currency=request.currency,
        exchange_rate=request.exchange_rate,
        split_type=request.split_type,
        created_by=user.id,
        receipt_image=request.receipt_image,
    )
    db.add(expense)
    await db.flush()

    # Create payers
    payers_amounts = {}
    for p in request.payers:
        paid_amount = p.amount_paid
        if request.currency != "INR" and request.exchange_rate:
            paid_amount = p.amount_paid * request.exchange_rate
        payer = ExpensePayer(
            expense_id=expense.id,
            user_id=p.user_id,
            amount_paid=paid_amount,
        )
        db.add(payer)
        payers_amounts[p.user_id] = paid_amount

    # Create splits
    for user_id, owed_amount in splits_data.items():
        split = ExpenseSplit(
            expense_id=expense.id,
            user_id=user_id,
            owed_amount=owed_amount,
        )
        db.add(split)

    # Update balances
    await _update_balances(str(request.group_id), payers_amounts, splits_data, db)

    # Create notifications for all group members
    result = await db.execute(
        select(GroupMember, User)
        .join(User, GroupMember.user_id == User.id)
        .where(
            GroupMember.group_id == request.group_id,
            GroupMember.user_id != user.id,
            GroupMember.invite_status == "accepted",
        )
    )
    members_data = result.all()
    for m, u in members_data:
        notification = Notification(
            user_id=m.user_id,
            type="expense_added",
            title="New Expense",
            message=f"{user.name} added an expense: {request.description or 'Untitled'} - {request.currency} {request.total_amount}",
        )
        db.add(notification)

        if u.email:
            html_content = f"""
            <h2>New Expense Added</h2>
            <p><b>{user.name}</b> just added a new expense: <b>{request.description or 'Untitled'}</b>.</p>
            <p>Amount: {request.currency} {request.total_amount}</p>
            <p>Log in to view your updated balances.</p>
            """
            asyncio.create_task(send_email_async(
                u.email,
                f"New Expense: {request.description or 'Untitled'}",
                html_content
            ))

    # Add system chat message
    system_message = ChatMessage(
        group_id=request.group_id,
        user_id=user.id,
        expense_id=expense.id,
        message=f"added an expense: {request.description or 'Untitled'} - {request.currency} {request.total_amount}",
    )
    db.add(system_message)

    await db.flush()
    await db.refresh(expense)
    await db.refresh(system_message)

    # Broadcast chat message with full expense data
    # Build payer/split details for inline display
    payer_details = []
    for p in request.payers:
        p_result = await db.execute(select(User).where(User.id == p.user_id))
        p_user = p_result.scalar_one_or_none()
        paid_amount = p.amount_paid
        if request.currency != "INR" and request.exchange_rate:
            paid_amount = p.amount_paid * request.exchange_rate
        payer_details.append({"user_name": p_user.name if p_user else "Unknown", "amount": paid_amount})

    split_details = []
    for uid, owed in splits_data.items():
        s_result = await db.execute(select(User).where(User.id == uid))
        s_user = s_result.scalar_one_or_none()
        split_details.append({"user_name": s_user.name if s_user else "Unknown", "amount": owed})

    msg_response = {
        "id": str(system_message.id),
        "group_id": str(system_message.group_id),
        "expense_id": str(expense.id),
        "user_id": str(system_message.user_id),
        "user_name": user.name,
        "user_avatar": user.profile_picture_url,
        "message": system_message.message,
        "is_system": True,
        "expense_data": {
            "description": request.description or "Untitled",
            "total_amount": float(expense.total_amount),
            "currency": request.currency,
            "split_type": request.split_type,
            "creator_name": user.name,
            "payers": payer_details,
            "splits": split_details,
            "created_at": expense.created_at.isoformat(),
            "can_edit": True,
        },
        "created_at": system_message.created_at.isoformat(),
    }
    await manager.broadcast_to_group(str(request.group_id), {
        "type": "chat_message",
        "data": msg_response,
    })

    return await _build_expense_response(expense, db)


@router.get("/group/{group_id}", response_model=List[ExpenseResponse])
async def list_group_expenses(
    group_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """List all expenses for a group."""
    user = await _get_current_user(firebase_uid, db)

    result = await db.execute(
        select(Expense)
        .where(Expense.group_id == group_id)
        .order_by(Expense.created_at.desc())
    )
    expenses = result.scalars().all()

    responses = []
    for exp in expenses:
        responses.append(await _build_expense_response(exp, db))
    return responses


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Get expense detail."""
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    return await _build_expense_response(expense, db)


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    request: ExpenseUpdateRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Edit expense (within 30 minutes only)."""
    user = await _get_current_user(firebase_uid, db)

    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Check 30-minute window
    now = datetime.now(timezone.utc)
    if (now - expense.created_at) > timedelta(minutes=30):
        raise HTTPException(status_code=400, detail="Expense can only be edited within 30 minutes of creation")

    # Get old payers and splits for balance reversal
    result = await db.execute(
        select(ExpensePayer).where(ExpensePayer.expense_id == expense.id)
    )
    old_payers = {str(ep.user_id): float(ep.amount_paid) for ep in result.scalars().all()}

    result = await db.execute(
        select(ExpenseSplit).where(ExpenseSplit.expense_id == expense.id)
    )
    old_splits = {str(es.user_id): float(es.owed_amount) for es in result.scalars().all()}

    # Reverse old balances
    await _update_balances(str(expense.group_id), old_payers, old_splits, db, subtract=True)

    # Update expense fields
    if request.description is not None:
        expense.description = request.description
    if request.total_amount is not None:
        expense.total_amount = request.total_amount
    if request.split_type is not None:
        expense.split_type = request.split_type

    # Update payers if provided
    if request.payers is not None:
        # Delete old payers
        for ep_result in (await db.execute(
            select(ExpensePayer).where(ExpensePayer.expense_id == expense.id)
        )).scalars().all():
            await db.delete(ep_result)

        new_payers = {}
        for p in request.payers:
            payer = ExpensePayer(
                expense_id=expense.id,
                user_id=p.user_id,
                amount_paid=p.amount_paid,
            )
            db.add(payer)
            new_payers[p.user_id] = p.amount_paid
    else:
        new_payers = old_payers

    # Update splits if provided
    if request.splits is not None:
        # Delete old splits
        for es_result in (await db.execute(
            select(ExpenseSplit).where(ExpenseSplit.expense_id == expense.id)
        )).scalars().all():
            await db.delete(es_result)

        total = float(expense.total_amount)
        new_splits = _calculate_splits(total, expense.split_type, request.splits)
        for user_id, owed in new_splits.items():
            split = ExpenseSplit(
                expense_id=expense.id,
                user_id=user_id,
                owed_amount=owed,
            )
            db.add(split)
    else:
        new_splits = old_splits

    # Apply new balances
    await _update_balances(str(expense.group_id), new_payers, new_splits, db)

    await db.flush()
    await db.refresh(expense)
    return await _build_expense_response(expense, db)


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Delete expense (within 30 minutes only)."""
    user = await _get_current_user(firebase_uid, db)

    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    now = datetime.now(timezone.utc)
    if (now - expense.created_at) > timedelta(minutes=30):
        raise HTTPException(status_code=400, detail="Expense can only be deleted within 30 minutes of creation")

    # Get payers and splits for balance reversal
    result = await db.execute(
        select(ExpensePayer).where(ExpensePayer.expense_id == expense.id)
    )
    payers = {str(ep.user_id): float(ep.amount_paid) for ep in result.scalars().all()}

    result = await db.execute(
        select(ExpenseSplit).where(ExpenseSplit.expense_id == expense.id)
    )
    splits = {str(es.user_id): float(es.owed_amount) for es in result.scalars().all()}

    # Reverse balances
    await _update_balances(str(expense.group_id), payers, splits, db, subtract=True)

    await db.delete(expense)
    await db.flush()
    return {"message": "Expense deleted"}
