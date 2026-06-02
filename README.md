# Splitnice

A modern, real-time expense sharing web application built with React and FastAPI. Split bills, track group expenses, settle debts, and chat with your group — all in one place.

## ✨ Features

### Core
- **Google Sign-In** — Secure authentication powered by Firebase Auth.
- **Group Management** — Create groups, invite members by email, and manage roles (admin/member).
- **Expense Tracking** — Add expenses with multiple payers and flexible split types:
  - Equal split
  - Percentage-based split
  - Exact amount split
  - Shares-based split
- **Settle Up** — Record payments between group members to clear debts.
- **Debt Simplification** — Minimize the number of transactions needed to settle all balances (toggleable per group).

### Communication
- **Real-Time Group Chat** — WebSocket-powered chat embedded in every group.
- **System Messages** — Automatic notifications in chat when expenses or settlements are added.
- **Email Notifications** — Email alerts for group invites and updates via Resend API.

### UI/UX
- **Responsive Design** — Optimized for both desktop and mobile.
- **Dark Theme** — Sleek dark UI with glassmorphism effects.
- **Smooth Animations** — Powered by Framer Motion.
- **Expense Details** — Click any expense in chat to see the full breakdown.

---

## 🛠 Tech Stack

| Layer      | Technology                                                    |
|------------|---------------------------------------------------------------|
| Frontend   | React 19, TypeScript, Tailwind CSS v4, Framer Motion, Axios   |
| Backend    | Python, FastAPI, SQLAlchemy (Async), WebSockets                |
| Database   | PostgreSQL (Neon serverless recommended)                       |
| Auth       | Firebase Authentication (Google Sign-In)                       |
| Email      | Resend API                                                     |
| Build Tool | Vite                                                           |

---

## 🚀 Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL database (local or [Neon](https://neon.tech))
- Firebase project with Authentication enabled
- (Optional) [Resend](https://resend.com) API key for real emails

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd splitwise-clone-spreetail
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env` from the example:
```bash
cp .env.example .env
```

Fill in your values:
```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
RESEND_API_KEY=re_your_api_key
FRONTEND_URL=http://localhost:5173
SECRET_KEY=your-secret-key

# Paste your Firebase service account JSON as a single-quoted multi-line string:
FIREBASE_CREDENTIALS_JSON='{
  "type": "service_account",
  "project_id": "your-project-id",
  ...
}'
```

> **Important:** The `FIREBASE_CREDENTIALS_JSON` value must be wrapped in single quotes (`'...'`) so that `python-dotenv` correctly parses the multi-line JSON.

Start the backend:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Tables are created automatically on startup.

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXX
VITE_API_BASE_URL=http://localhost:8000
```

Start the frontend:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 📁 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, routers
│   │   ├── database.py          # SQLAlchemy async engine & session
│   │   ├── models.py            # ORM models (User, Group, Expense, etc.)
│   │   ├── firebase_auth.py     # Firebase token verification
│   │   ├── email_service.py     # Resend email integration
│   │   ├── config.py            # Pydantic settings
│   │   └── routers/
│   │       ├── auth.py          # Login, profile, account claiming
│   │       ├── groups.py        # CRUD, members, invites
│   │       ├── expenses.py      # Add/edit/delete expenses, splits
│   │       ├── settlements.py   # Record settle-up payments
│   │       ├── balances.py      # Balance calculation & simplification
│   │       ├── chat.py          # WebSocket chat
│   │       ├── notifications.py # In-app notifications
│   │       └── users.py         # User search
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── context/             # AuthContext, ThemeContext
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # LandingPage, Dashboard, GroupDetails
│   │   └── services/            # API client, Firebase config
│   ├── index.html
│   └── package.json
├── render.yaml                  # Render deployment blueprint
├── build.sh                     # Production build script
└── README.md
```

---

## 🌐 Deployment (Render)

This project is configured for unified deployment on [Render](https://render.com).

1. Push your code to GitHub.
2. Connect the repository to Render — it will detect `render.yaml` automatically.
3. Set the required environment variables in the Render dashboard:
   - `DATABASE_URL` — your Neon PostgreSQL connection string
   - `FIREBASE_CREDENTIALS_JSON` — your Firebase service account JSON
   - `RESEND_API_KEY` — your Resend API key
   - `VITE_FIREBASE_*` — all frontend Firebase config vars
4. Render will run `build.sh`, which installs Python dependencies, builds the React frontend, and serves everything from FastAPI.

---

## 📝 API Documentation

Once the backend is running, interactive API docs are available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## 📄 License

This project is for educational and personal use.
