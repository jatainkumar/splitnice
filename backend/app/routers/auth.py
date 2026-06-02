from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional
import uuid

from app.database import get_db
from app.models import User, GroupMember
from app.firebase_auth import get_current_user_uid

router = APIRouter()


class LoginRequest(BaseModel):
    name: str
    email: str
    profile_picture_url: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    mobile_number: Optional[str] = None
    profile_picture_url: Optional[str] = None
    currency_preference: Optional[str] = None
    theme_preference: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    firebase_uid: Optional[str] = None
    name: str
    email: str
    mobile_number: Optional[str] = None
    profile_picture_url: Optional[str] = None
    currency_preference: str
    theme_preference: str
    is_claimed: bool

    class Config:
        from_attributes = True


@router.post("/login", response_model=UserResponse)
async def login(
    request: LoginRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Verify Firebase token, create or fetch user."""
    # Check if user exists by Firebase UID
    result = await db.execute(
        select(User).where(User.firebase_uid == firebase_uid)
    )
    user = result.scalar_one_or_none()

    if user:
        # Update name/photo if changed
        if request.name:
            user.name = request.name
        if request.profile_picture_url:
            user.profile_picture_url = request.profile_picture_url
        await db.flush()
    else:
        # Check if unclaimed user exists with this email
        result = await db.execute(
            select(User).where(User.email == request.email, User.is_claimed == False)
        )
        unclaimed_user = result.scalar_one_or_none()

        if unclaimed_user:
            # Claim the account
            unclaimed_user.firebase_uid = firebase_uid
            unclaimed_user.name = request.name
            unclaimed_user.profile_picture_url = request.profile_picture_url
            unclaimed_user.is_claimed = True
            user = unclaimed_user

            # Auto-accept all pending invites for this user
            await db.execute(
                update(GroupMember)
                .where(
                    GroupMember.user_id == user.id,
                    GroupMember.invite_status == 'pending'
                )
                .values(invite_status='accepted')
            )
        else:
            # Create new user
            user = User(
                firebase_uid=firebase_uid,
                name=request.name,
                email=request.email,
                profile_picture_url=request.profile_picture_url,
            )
            db.add(user)

    await db.flush()
    await db.refresh(user)
    return UserResponse(
        id=str(user.id),
        firebase_uid=user.firebase_uid,
        name=user.name,
        email=user.email,
        mobile_number=user.mobile_number,
        profile_picture_url=user.profile_picture_url,
        currency_preference=user.currency_preference,
        theme_preference=user.theme_preference,
        is_claimed=user.is_claimed,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile."""
    result = await db.execute(
        select(User).where(User.firebase_uid == firebase_uid)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fallback to auto-accept pending invites if they were missed during claim
    await db.execute(
        update(GroupMember)
        .where(
            GroupMember.user_id == user.id,
            GroupMember.invite_status == 'pending'
        )
        .values(invite_status='accepted')
    )
    await db.flush()

    return UserResponse(
        id=str(user.id),
        firebase_uid=user.firebase_uid,
        name=user.name,
        email=user.email,
        mobile_number=user.mobile_number,
        profile_picture_url=user.profile_picture_url,
        currency_preference=user.currency_preference,
        theme_preference=user.theme_preference,
        is_claimed=user.is_claimed,
    )


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile."""
    result = await db.execute(
        select(User).where(User.firebase_uid == firebase_uid)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if request.name is not None:
        user.name = request.name
    if request.mobile_number is not None:
        # Check if mobile number is already taken
        existing = await db.execute(
            select(User).where(
                User.mobile_number == request.mobile_number,
                User.id != user.id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Mobile number already in use")
        user.mobile_number = request.mobile_number
    if request.profile_picture_url is not None:
        user.profile_picture_url = request.profile_picture_url
    if request.currency_preference is not None:
        user.currency_preference = request.currency_preference
    if request.theme_preference is not None:
        user.theme_preference = request.theme_preference

    await db.flush()
    await db.refresh(user)
    return UserResponse(
        id=str(user.id),
        firebase_uid=user.firebase_uid,
        name=user.name,
        email=user.email,
        mobile_number=user.mobile_number,
        profile_picture_url=user.profile_picture_url,
        currency_preference=user.currency_preference,
        theme_preference=user.theme_preference,
        is_claimed=user.is_claimed,
    )
