from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from collections import defaultdict
import json

from app.database import get_db, AsyncSessionLocal
from app.models import User, ChatMessage, GroupMember, Expense, ExpensePayer, ExpenseSplit
from app.firebase_auth import get_current_user_uid
import asyncio
from app.email_service import send_email_async

router = APIRouter()


from app.websocket_manager import manager


from datetime import datetime, timezone, timedelta

class MessageCreateRequest(BaseModel):
    group_id: str
    expense_id: Optional[str] = None
    message: str


class SplitDetail(BaseModel):
    user_name: str
    amount: float


class ExpenseData(BaseModel):
    description: Optional[str] = None
    total_amount: float
    currency: str
    split_type: str
    creator_name: str
    payers: List[SplitDetail]
    splits: List[SplitDetail]
    created_at: str
    can_edit: bool


class MessageResponse(BaseModel):
    id: str
    group_id: str
    expense_id: Optional[str] = None
    user_id: str
    user_name: str
    user_avatar: Optional[str] = None
    message: str
    is_system: bool = False
    expense_data: Optional[ExpenseData] = None
    created_at: str


async def _enrich_expense_data(expense_id: str, db: AsyncSession) -> Optional[ExpenseData]:
    """Load expense details (payers + splits) for inline display."""
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        return None

    creator_result = await db.execute(select(User).where(User.id == expense.created_by))
    creator = creator_result.scalar_one_or_none()

    payer_result = await db.execute(
        select(ExpensePayer, User)
        .join(User, ExpensePayer.user_id == User.id)
        .where(ExpensePayer.expense_id == expense.id)
    )
    payers = [SplitDetail(user_name=u.name, amount=float(ep.amount_paid)) for ep, u in payer_result.all()]

    split_result = await db.execute(
        select(ExpenseSplit, User)
        .join(User, ExpenseSplit.user_id == User.id)
        .where(ExpenseSplit.expense_id == expense.id)
    )
    splits = [SplitDetail(user_name=u.name, amount=float(es.owed_amount)) for es, u in split_result.all()]

    now = datetime.now(timezone.utc)
    can_edit = (now - expense.created_at) < timedelta(minutes=30)

    return ExpenseData(
        description=expense.description,
        total_amount=float(expense.total_amount),
        currency=expense.currency,
        split_type=expense.split_type,
        creator_name=creator.name if creator else "Unknown",
        payers=payers,
        splits=splits,
        created_at=expense.created_at.isoformat(),
        can_edit=can_edit,
    )


@router.get("/group/{group_id}", response_model=List[MessageResponse])
async def get_group_messages(
    group_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Get chat messages for a group (including expense system messages)."""
    result = await db.execute(
        select(ChatMessage, User)
        .join(User, ChatMessage.user_id == User.id)
        .where(ChatMessage.group_id == group_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.all()

    responses = []
    for msg, user in messages:
        is_system = msg.expense_id is not None
        expense_data = None
        if is_system and msg.expense_id:
            expense_data = await _enrich_expense_data(str(msg.expense_id), db)

        responses.append(MessageResponse(
            id=str(msg.id),
            group_id=str(msg.group_id),
            expense_id=str(msg.expense_id) if msg.expense_id else None,
            user_id=str(msg.user_id),
            user_name=user.name,
            user_avatar=user.profile_picture_url,
            message=msg.message,
            is_system=is_system,
            expense_data=expense_data,
            created_at=msg.created_at.isoformat(),
        ))
    return responses


@router.get("/expense/{expense_id}/comments", response_model=List[MessageResponse])
async def get_expense_comments(
    expense_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Get comments for a specific expense."""
    result = await db.execute(
        select(ChatMessage, User)
        .join(User, ChatMessage.user_id == User.id)
        .where(ChatMessage.expense_id == expense_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.all()

    return [
        MessageResponse(
            id=str(msg.id),
            group_id=str(msg.group_id),
            expense_id=str(msg.expense_id),
            user_id=str(msg.user_id),
            user_name=user.name,
            user_avatar=user.profile_picture_url,
            message=msg.message,
            created_at=msg.created_at.isoformat(),
        )
        for msg, user in messages
    ]


@router.post("/message", response_model=MessageResponse)
async def send_message(
    request: MessageCreateRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Send a chat message or expense comment."""
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    msg = ChatMessage(
        group_id=request.group_id,
        expense_id=request.expense_id,
        user_id=user.id,
        message=request.message,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)

    response = MessageResponse(
        id=str(msg.id),
        group_id=str(msg.group_id),
        expense_id=str(msg.expense_id) if msg.expense_id else None,
        user_id=str(msg.user_id),
        user_name=user.name,
        user_avatar=user.profile_picture_url,
        message=msg.message,
        created_at=msg.created_at.isoformat(),
    )

    # Broadcast via WebSocket
    await manager.broadcast_to_group(request.group_id, {
        "type": "chat_message",
        "data": response.model_dump(),
    })

    return response


@router.websocket("/ws/{group_id}")
async def websocket_endpoint(websocket: WebSocket, group_id: str):
    """WebSocket for real-time group chat and updates."""
    await manager.connect(websocket, group_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                # Handle incoming WebSocket messages
                if message_data.get("type") == "chat_message":
                    async with AsyncSessionLocal() as db:
                        user_id = message_data.get("user_id")
                        result = await db.execute(select(User).where(User.id == user_id))
                        user = result.scalar_one_or_none()
                        if user:
                            msg = ChatMessage(
                                group_id=group_id,
                                expense_id=message_data.get("expense_id"),
                                user_id=user_id,
                                message=message_data.get("message", ""),
                            )
                            db.add(msg)
                            await db.commit()
                            await db.refresh(msg)

                            response = {
                                "type": "chat_message",
                                "data": {
                                    "id": str(msg.id),
                                    "group_id": group_id,
                                    "expense_id": str(msg.expense_id) if msg.expense_id else None,
                                    "user_id": str(msg.user_id),
                                    "user_name": user.name,
                                    "user_avatar": user.profile_picture_url,
                                    "message": msg.message,
                                    "created_at": msg.created_at.isoformat(),
                                }
                            }
                            await manager.broadcast_to_group(group_id, response)

                            # Send email to other members
                            members_result = await db.execute(
                                select(GroupMember, User)
                                .join(User, GroupMember.user_id == User.id)
                                .where(
                                    GroupMember.group_id == group_id,
                                    GroupMember.user_id != user_id,
                                    GroupMember.invite_status == 'accepted'
                                )
                            )
                            for m, u in members_result.all():
                                if u.email:
                                    html_content = f"""
                                    <h2>New Message</h2>
                                    <p><b>{user.name}</b> says:</p>
                                    <p>"{msg.message}"</p>
                                    """
                                    asyncio.create_task(send_email_async(
                                        u.email,
                                        "New Chat Message",
                                        html_content
                                    ))

            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, group_id)
