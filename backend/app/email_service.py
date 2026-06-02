import os
import resend
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv()

executor = ThreadPoolExecutor(max_workers=3)

# Configure Resend
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

FROM_EMAIL = os.getenv("FROM_EMAIL", "Splitnice <onboarding@resend.dev>")

def send_email_sync(to_email: str, subject: str, html_content: str):
    if not RESEND_API_KEY:
        print("\n" + "="*60)
        print(f"📩 MOCK EMAIL SENT TO: {to_email}")
        print(f"📝 SUBJECT: {subject}")
        print(f"📄 BODY:\n{html_content}")
        print("="*60 + "\n")
        return

    try:
        params = {
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        resend.Emails.send(params)
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

async def send_email_async(to_email: str, subject: str, html_content: str):
    """
    Sends an email asynchronously via Resend without blocking the main thread.
    """
    if not to_email:
        return
        
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        executor, 
        send_email_sync, 
        to_email, 
        subject, 
        html_content
    )
