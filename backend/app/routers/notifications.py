from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models import User, Notification, PingLog
from app.firebase_auth import get_current_user_uid

router = APIRouter()


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: Optional[str] = None
    is_read: bool
    created_at: str


async def _get_current_user(firebase_uid: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    unread_only: bool = False,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Get notifications for the current user."""
    user = await _get_current_user(firebase_uid, db)

    query = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)
    query = query.order_by(Notification.created_at.desc()).limit(50)

    result = await db.execute(query)
    notifications = result.scalars().all()

    return [
        NotificationResponse(
            id=str(n.id),
            type=n.type,
            title=n.title,
            message=n.message,
            is_read=n.is_read,
            created_at=n.created_at.isoformat(),
        )
        for n in notifications
    ]


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    user = await _get_current_user(firebase_uid, db)

    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.flush()
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_as_read(
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read."""
    user = await _get_current_user(firebase_uid, db)

    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.flush()
    return {"message": "All notifications marked as read"}


@router.post("/ping/{target_user_id}")
async def ping_to_settle(
    target_user_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Ping a user to settle. Rate limited to once per 4 hours."""
    user = await _get_current_user(firebase_uid, db)

    # Check rate limit
    result = await db.execute(
        select(PingLog).where(
            PingLog.from_user_id == user.id,
            PingLog.to_user_id == target_user_id,
        )
    )
    ping_log = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if ping_log:
        time_since_last = now - ping_log.last_pinged_at
        if time_since_last < timedelta(hours=4):
            remaining = timedelta(hours=4) - time_since_last
            hours = int(remaining.total_seconds() // 3600)
            minutes = int((remaining.total_seconds() % 3600) // 60)
            raise HTTPException(
                status_code=429,
                detail=f"You can ping again in {hours}h {minutes}m"
            )
        ping_log.last_pinged_at = now
    else:
        ping_log = PingLog(
            from_user_id=user.id,
            to_user_id=target_user_id,
            last_pinged_at=now,
        )
        db.add(ping_log)

    # Create notification
    notification = Notification(
        user_id=target_user_id,
        type="ping",
        title="Settle Up Reminder",
        message=f"{user.name} is reminding you to settle up!",
    )
    db.add(notification)

    await db.flush()

    # Send Email
    target_user_result = await db.execute(select(User).where(User.id == target_user_id))
    target_user = target_user_result.scalar_one_or_none()
    if target_user and target_user.email:
        from app.email_service import send_email_async
        import asyncio
        html_content = f"""
        <h2>Settle Up Reminder</h2>
        <p><b>{user.name}</b> is reminding you to settle up your balances on Splitnice!</p>
        <p>Log in to the app to view your balances and record a settlement.</p>
        """
        asyncio.create_task(send_email_async(
            target_user.email,
            "Settle Up Reminder",
            html_content
        ))

    return {"message": "Ping sent successfully"}
