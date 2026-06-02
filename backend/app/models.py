import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Numeric, Text, Enum, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def generate_uuid():
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    firebase_uid = Column(String(128), unique=True, nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    mobile_number = Column(String(20), unique=True, nullable=True)
    profile_picture_url = Column(Text, nullable=True)
    currency_preference = Column(String(10), default="INR")
    theme_preference = Column(String(10), default="dark")
    is_claimed = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    group_memberships = relationship("GroupMember", back_populates="user")
    created_groups = relationship("Group", back_populates="creator")
    notifications = relationship("Notification", back_populates="user")


class Group(Base):
    __tablename__ = "groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    group_photo_url = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    simplify_debts = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    is_implicit = Column(Boolean, default=False)  # True for auto-created 2-person groups
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    creator = relationship("User", back_populates="created_groups")
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="group", cascade="all, delete-orphan")
    settlements = relationship("Settlement", back_populates="group", cascade="all, delete-orphan")
    balances = relationship("Balance", back_populates="group", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String(10), default="member")  # 'admin' or 'member'
    invite_status = Column(String(10), default="pending")  # 'pending', 'accepted', 'rejected'
    joined_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )

    # Relationships
    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="group_memberships")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    description = Column(String(255), nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), default="INR")
    exchange_rate = Column(Numeric(12, 6), nullable=True)  # Rate to INR
    split_type = Column(String(20), nullable=False)  # 'equal', 'unequal', 'percentage', 'share'
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    receipt_image = Column(Text, nullable=True)  # Base64 encoded
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    group = relationship("Group", back_populates="expenses")
    creator = relationship("User")
    payers = relationship("ExpensePayer", back_populates="expense", cascade="all, delete-orphan")
    splits = relationship("ExpenseSplit", back_populates="expense", cascade="all, delete-orphan")
    comments = relationship("ChatMessage", back_populates="expense")


class ExpensePayer(Base):
    __tablename__ = "expense_payers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False)

    # Relationships
    expense = relationship("Expense", back_populates="payers")
    user = relationship("User")


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owed_amount = Column(Numeric(12, 2), nullable=False)

    # Relationships
    expense = relationship("Expense", back_populates="splits")
    user = relationship("User")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    payer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    payee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(50), nullable=True)  # 'cash', 'gpay', 'phonepe', 'paytm'
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    group = relationship("Group", back_populates="settlements")
    payer = relationship("User", foreign_keys=[payer_id])
    payee = relationship("User", foreign_keys=[payee_id])


class Balance(Base):
    __tablename__ = "balances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    from_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(12, 2), default=0)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("group_id", "from_user_id", "to_user_id", name="uq_balance"),
    )

    # Relationships
    group = relationship("Group", back_populates="balances")
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    group = relationship("Group", back_populates="chat_messages")
    expense = relationship("Expense", back_populates="comments")
    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    user = relationship("User", back_populates="notifications")


class PingLog(Base):
    __tablename__ = "ping_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    from_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    last_pinged_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint("from_user_id", "to_user_id", name="uq_ping"),
    )

    # Relationships
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
