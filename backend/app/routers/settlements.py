from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.models import User, GroupMember, Settlement, Balance, Notification, ChatMessage
from app.firebase_auth import get_current_user_uid
from app.websocket_manager import manager
import asyncio
from app.email_service import send_email_async

router = APIRouter()


class SettlementCreateRequest(BaseModel):
    group_id: str
    payee_id: str  # Person receiving the payment
    amount: float
    payment_method: Optional[str] = None  # 'cash', 'gpay', 'phonepe', 'paytm'


class SettlementResponse(BaseModel):
    id: str
    group_id: str
    payer_id: str
    payer_name: str
    payee_id: str
    payee_name: str
    amount: float
    payment_method: Optional[str] = None
    created_at: str


async def _get_current_user(firebase_uid: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("", response_model=SettlementResponse)
async def create_settlement(
    request: SettlementCreateRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Record a settlement payment."""
    user = await _get_current_user(firebase_uid, db)

    # Verify membership
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == request.group_id,
            GroupMember.user_id == user.id,
            GroupMember.invite_status == "accepted",
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Get payee
    result = await db.execute(select(User).where(User.id == request.payee_id))
    payee = result.scalar_one_or_none()
    if not payee:
        raise HTTPException(status_code=404, detail="Payee not found")

    # Create settlement
    settlement = Settlement(
        group_id=request.group_id,
        payer_id=user.id,
        payee_id=request.payee_id,
        amount=request.amount,
        payment_method=request.payment_method,
    )
    db.add(settlement)

    # Update balance: reduce what payer owes payee
    result = await db.execute(
        select(Balance).where(
            Balance.group_id == request.group_id,
            Balance.from_user_id == user.id,
            Balance.to_user_id == request.payee_id,
        )
    )
    balance = result.scalar_one_or_none()
    if balance:
        balance.amount = float(balance.amount) - request.amount
    else:
        # Check reverse direction
        result = await db.execute(
            select(Balance).where(
                Balance.group_id == request.group_id,
                Balance.from_user_id == request.payee_id,
                Balance.to_user_id == user.id,
            )
        )
        reverse_balance = result.scalar_one_or_none()
        if reverse_balance:
            reverse_balance.amount = float(reverse_balance.amount) + request.amount
        else:
            # Create new balance (negative means overpaid)
            balance = Balance(
                group_id=request.group_id,
                from_user_id=user.id,
                to_user_id=request.payee_id,
                amount=-request.amount,
            )
            db.add(balance)

    # Notify payee
    notification = Notification(
        user_id=request.payee_id,
        type="settlement",
        title="Payment Received",
        message=f"{user.name} settled INR {request.amount} with you via {request.payment_method or 'unknown'}",
    )
    db.add(notification)

    if payee.email:
        html_content = f"""
        <h2>Payment Received</h2>
        <p><b>{user.name}</b> just paid you <b>INR {request.amount}</b> via {request.payment_method or 'unknown'}.</p>
        """
        asyncio.create_task(send_email_async(
            payee.email,
            "Payment Received",
            html_content
        ))

    # Add system chat message
    system_message = ChatMessage(
        group_id=request.group_id,
        user_id=user.id,
        message=f"paid INR {request.amount} to {payee.name} via {request.payment_method or 'unknown'}",
    )
    db.add(system_message)

    await db.flush()
    await db.refresh(settlement)
    await db.refresh(system_message)

    # Broadcast chat message
    msg_response = {
        "id": str(system_message.id),
        "group_id": str(system_message.group_id),
        "expense_id": None,
        "user_id": str(system_message.user_id),
        "user_name": user.name,
        "user_avatar": user.profile_picture_url,
        "message": system_message.message,
        "created_at": system_message.created_at.isoformat(),
    }
    await manager.broadcast_to_group(str(request.group_id), {
        "type": "chat_message",
        "data": msg_response,
    })

    return SettlementResponse(
        id=str(settlement.id),
        group_id=str(settlement.group_id),
        payer_id=str(settlement.payer_id),
        payer_name=user.name,
        payee_id=str(settlement.payee_id),
        payee_name=payee.name,
        amount=float(settlement.amount),
        payment_method=settlement.payment_method,
        created_at=settlement.created_at.isoformat(),
    )


@router.get("/group/{group_id}", response_model=List[SettlementResponse])
async def list_settlements(
    group_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """List settlements for a group."""
    result = await db.execute(
        select(Settlement)
        .where(Settlement.group_id == group_id)
        .order_by(Settlement.created_at.desc())
    )
    settlements = result.scalars().all()

    responses = []
    for s in settlements:
        payer_result = await db.execute(select(User).where(User.id == s.payer_id))
        payer = payer_result.scalar_one()
        payee_result = await db.execute(select(User).where(User.id == s.payee_id))
        payee = payee_result.scalar_one()

        responses.append(SettlementResponse(
            id=str(s.id),
            group_id=str(s.group_id),
            payer_id=str(s.payer_id),
            payer_name=payer.name,
            payee_id=str(s.payee_id),
            payee_name=payee.name,
            amount=float(s.amount),
            payment_method=s.payment_method,
            created_at=s.created_at.isoformat(),
        ))
    return responses
