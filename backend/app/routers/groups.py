from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
import uuid
import asyncio

from app.database import get_db
from app.models import User, Group, GroupMember, Balance, Notification
from app.firebase_auth import get_current_user_uid
from app.email_service import send_email_async

router = APIRouter()


class GroupCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    group_photo_url: Optional[str] = None


class GroupUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    group_photo_url: Optional[str] = None
    simplify_debts: Optional[bool] = None


class MemberAddRequest(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    name: Optional[str] = None  # For unclaimed users


class InviteActionRequest(BaseModel):
    action: str  # 'accept' or 'reject'


class MemberResponse(BaseModel):
    id: str
    user_id: str
    name: str
    email: str
    mobile_number: Optional[str] = None
    profile_picture_url: Optional[str] = None
    role: str
    invite_status: str
    is_claimed: bool


class GroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    group_photo_url: Optional[str] = None
    created_by: str
    simplify_debts: bool
    is_archived: bool
    is_implicit: bool
    members: List[MemberResponse] = []
    created_at: str


async def _get_current_user(firebase_uid: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _check_admin(group_id: str, user_id, db: AsyncSession):
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.role == "admin",
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Only group admin can perform this action")
    return member


async def _check_member(group_id: str, user_id, db: AsyncSession):
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.invite_status == 'accepted',
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Only group members can perform this action")
    return member


async def _build_group_response(group: Group, db: AsyncSession) -> GroupResponse:
    result = await db.execute(
        select(GroupMember, User)
        .join(User, GroupMember.user_id == User.id)
        .where(GroupMember.group_id == group.id)
    )
    members_data = result.all()

    members = []
    for gm, user in members_data:
        members.append(MemberResponse(
            id=str(gm.id),
            user_id=str(user.id),
            name=user.name,
            email=user.email,
            mobile_number=user.mobile_number,
            profile_picture_url=user.profile_picture_url,
            role=gm.role,
            invite_status=gm.invite_status,
            is_claimed=user.is_claimed,
        ))

    return GroupResponse(
        id=str(group.id),
        name=group.name,
        description=group.description,
        group_photo_url=group.group_photo_url,
        created_by=str(group.created_by),
        simplify_debts=group.simplify_debts,
        is_archived=group.is_archived,
        is_implicit=group.is_implicit,
        members=members,
        created_at=group.created_at.isoformat(),
    )


@router.post("", response_model=GroupResponse)
async def create_group(
    request: GroupCreateRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Create a new group."""
    user = await _get_current_user(firebase_uid, db)

    group = Group(
        name=request.name,
        description=request.description,
        group_photo_url=request.group_photo_url,
        created_by=user.id,
    )
    db.add(group)
    await db.flush()

    # Add creator as admin member (auto-accepted)
    member = GroupMember(
        group_id=group.id,
        user_id=user.id,
        role="admin",
        invite_status="accepted",
    )
    db.add(member)
    await db.flush()
    await db.refresh(group)

    return await _build_group_response(group, db)


@router.get("", response_model=List[GroupResponse])
async def list_groups(
    include_archived: bool = False,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """List all groups for the current user."""
    user = await _get_current_user(firebase_uid, db)

    query = (
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user.id)
    )
    if not include_archived:
        query = query.where(Group.is_archived == False)

    result = await db.execute(query.order_by(Group.updated_at.desc()))
    groups = result.scalars().all()

    responses = []
    for group in groups:
        responses.append(await _build_group_response(group, db))
    return responses


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Get group detail."""
    user = await _get_current_user(firebase_uid, db)

    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check membership
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this group")

    return await _build_group_response(group, db)


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    request: GroupUpdateRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Update group settings."""
    user = await _get_current_user(firebase_uid, db)
    await _check_member(group_id, user.id, db)

    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if request.name is not None:
        group.name = request.name
    if request.description is not None:
        group.description = request.description
    if request.group_photo_url is not None:
        group.group_photo_url = request.group_photo_url
    if request.simplify_debts is not None:
        group.simplify_debts = request.simplify_debts

    await db.flush()
    await db.refresh(group)
    return await _build_group_response(group, db)


@router.delete("/{group_id}")
async def archive_group(
    group_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Archive a group (soft delete). All balances must be settled."""
    user = await _get_current_user(firebase_uid, db)
    await _check_admin(group_id, user.id, db)

    # Check for unsettled balances
    result = await db.execute(
        select(Balance).where(
            Balance.group_id == group_id,
            func.abs(Balance.amount) >= 0.01,
        )
    )
    unsettled = result.scalars().all()
    if unsettled:
        raise HTTPException(
            status_code=400,
            detail="Cannot archive group with unsettled balances"
        )

    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    group.is_archived = True
    await db.flush()
    return {"message": "Group archived successfully"}


@router.delete("/{group_id}/permanent")
async def permanently_delete_group(
    group_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete an archived group."""
    user = await _get_current_user(firebase_uid, db)
    await _check_admin(group_id, user.id, db)

    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not group.is_archived:
        raise HTTPException(status_code=400, detail="Group must be archived before permanent deletion")

    await db.delete(group)
    await db.flush()
    return {"message": "Group permanently deleted"}


@router.post("/{group_id}/members", response_model=MemberResponse)
async def add_member(
    group_id: str,
    request: MemberAddRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Add/invite a member to the group."""
    user = await _get_current_user(firebase_uid, db)
    
    # Check if user is a member of the group
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user.id,
            GroupMember.invite_status == 'accepted'
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Must be a member to invite others")

    # Check group member count
    result = await db.execute(
        select(func.count(GroupMember.id)).where(GroupMember.group_id == group_id)
    )
    count = result.scalar()
    if count >= 6:
        raise HTTPException(status_code=400, detail="Group has reached maximum of 6 members")

    target_user = None
    if request.user_id:
        result = await db.execute(select(User).where(User.id == request.user_id))
        target_user = result.scalar_one_or_none()
    elif request.email:
        result = await db.execute(select(User).where(User.email == request.email))
        target_user = result.scalar_one_or_none()
    elif request.mobile_number:
        result = await db.execute(select(User).where(User.mobile_number == request.mobile_number))
        target_user = result.scalar_one_or_none()

    if not target_user and (request.mobile_number or request.email):
        # Create unclaimed user
        target_user = User(
            name=request.name or "Unclaimed User",
            email=request.email or f"unclaimed_{uuid.uuid4().hex[:8]}@placeholder.com",
            mobile_number=request.mobile_number,
            is_claimed=False,
        )
        db.add(target_user)
        await db.flush()

    if not target_user:
        raise HTTPException(status_code=400, detail="User not found and cannot create unclaimed user")

    # Check if already a member
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member")

    member = GroupMember(
        group_id=group_id,
        user_id=target_user.id,
        role="member",
        invite_status="pending",
    )
    db.add(member)

    # Create notification for the invited user
    notification = Notification(
        user_id=target_user.id,
        type="group_invite",
        title="Group Invitation",
        message=f"You have been invited to join a group",
    )
    db.add(notification)

    await db.flush()

    if target_user.email:
        html_content = f"""
        <h2>You've been invited!</h2>
        <p><b>{user.name}</b> has invited you to join a group.</p>
        <p>Log in or sign up to view your group and expenses.</p>
        """
        asyncio.create_task(send_email_async(
            target_user.email,
            "Group Invitation",
            html_content
        ))

    return MemberResponse(
        id=str(member.id),
        user_id=str(target_user.id),
        name=target_user.name,
        email=target_user.email,
        mobile_number=target_user.mobile_number,
        profile_picture_url=target_user.profile_picture_url,
        role=member.role,
        invite_status=member.invite_status,
        is_claimed=target_user.is_claimed,
    )


@router.put("/{group_id}/members/{member_user_id}")
async def handle_invite(
    group_id: str,
    member_user_id: str,
    request: InviteActionRequest,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Accept or reject a group invitation."""
    user = await _get_current_user(firebase_uid, db)

    # User can only accept/reject their own invite
    if str(user.id) != member_user_id:
        raise HTTPException(status_code=403, detail="Can only respond to your own invitations")

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == member_user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if member.invite_status != "pending":
        raise HTTPException(status_code=400, detail="Invitation already handled")

    if request.action == "accept":
        member.invite_status = "accepted"
    elif request.action == "reject":
        member.invite_status = "rejected"
    else:
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'reject'")

    await db.flush()
    return {"message": f"Invitation {request.action}ed"}


@router.delete("/{group_id}/members/{member_user_id}")
async def remove_member(
    group_id: str,
    member_user_id: str,
    firebase_uid: str = Depends(get_current_user_uid),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the group. Admin only. Must have settled balance."""
    user = await _get_current_user(firebase_uid, db)
    await _check_admin(group_id, user.id, db)

    if str(user.id) == member_user_id:
        raise HTTPException(status_code=400, detail="Admin cannot remove themselves")

    # Check for unsettled balances
    from sqlalchemy import or_
    result = await db.execute(
        select(Balance).where(
            Balance.group_id == group_id,
            or_(Balance.from_user_id == member_user_id, Balance.to_user_id == member_user_id)
        )
    )
    balances = result.scalars().all()
    unsettled = any(abs(float(b.amount)) >= 0.01 for b in balances)
    if unsettled:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove member with unsettled balances"
        )

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == member_user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(member)

    # Notify removed user
    notification = Notification(
        user_id=member_user_id,
        type="group_removed",
        title="Removed from Group",
        message="You have been removed from a group",
    )
    db.add(notification)

    await db.flush()
    return {"message": "Member removed"}
