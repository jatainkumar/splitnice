from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.models import User
from app.firebase_auth import get_current_user_uid

router = APIRouter()


class UserSearchResponse(BaseModel):
    id: str
    name: str
    email: str
    mobile_number: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_claimed: bool

    class Config:
        from_attributes = True


@router.get("/search", response_model=List[UserSearchResponse])
async def search_users(
    q: Optional[str] = None,
    mobile: Optional[str] = None,
    email: Optional[str] = None,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Search users by mobile number, email, or name."""
    if mobile:
        result = await db.execute(
            select(User).where(User.mobile_number == mobile)
        )
    elif email:
        result = await db.execute(
            select(User).where(User.email.ilike(f"%{email}%"))
        )
    elif q:
        result = await db.execute(
            select(User).where(User.name.ilike(f"%{q}%"))
        )
    else:
        return []

    users = result.scalars().all()
    return [
        UserSearchResponse(
            id=str(u.id),
            name=u.name,
            email=u.email,
            mobile_number=u.mobile_number,
            profile_picture_url=u.profile_picture_url,
            is_claimed=u.is_claimed,
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=UserSearchResponse)
async def get_user(
    user_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Get user by ID."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserSearchResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        mobile_number=user.mobile_number,
        profile_picture_url=user.profile_picture_url,
        is_claimed=user.is_claimed,
    )
