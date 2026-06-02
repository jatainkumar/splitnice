import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import json
from dotenv import load_dotenv

# Load .env BEFORE reading any env vars
load_dotenv()

# Initialize Firebase Admin SDK
firebase_app = None


def init_firebase():
    global firebase_app
    if firebase_app:
        return

    creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON", "")
    if creds_json:
        try:
            cred_dict = json.loads(creds_json)
            cred = credentials.Certificate(cred_dict)
            firebase_app = firebase_admin.initialize_app(cred)
            print(f"[OK] Firebase initialized successfully (project: {cred_dict.get('project_id', 'unknown')})")
        except Exception as e:
            print(f"[ERROR] Firebase init error with JSON: {e}")
            # Try default credentials
            try:
                firebase_app = firebase_admin.initialize_app()
                print("[OK] Firebase initialized with default credentials")
            except Exception as e2:
                print(f"[ERROR] Firebase init failed completely: {e2}")
    else:
        print("[WARN] FIREBASE_CREDENTIALS_JSON env var is empty!")
        try:
            firebase_app = firebase_admin.initialize_app()
            print("[OK] Firebase initialized with default credentials")
        except Exception as e:
            print(f"[ERROR] Firebase init failed - running without auth verification: {e}")


# Initialize on import
init_firebase()

security = HTTPBearer()


async def get_current_user_uid(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Verify Firebase ID token and return the user's Firebase UID."""
    token = credentials.credentials
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token["uid"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
        )
