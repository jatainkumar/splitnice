import asyncio
import sys
import os

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.models import User, GroupMember
from sqlalchemy import select, update

async def fix_invites():
    print("Starting fix...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(GroupMember).join(User, GroupMember.user_id == User.id)
            .where(GroupMember.invite_status == 'pending', User.is_claimed == True)
        )
        members = result.scalars().all()
        for m in members:
            m.invite_status = 'accepted'
            print(f"Fixed member {m.id} for user {m.user_id}")
        await db.commit()
        print(f"Fixed {len(members)} pending invites.")

if __name__ == "__main__":
    asyncio.run(fix_invites())
