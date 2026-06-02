# Splitnice — Deployment Guide

This guide walks you through deploying Splitnice to **Render** (free tier compatible) with a **Neon** PostgreSQL database and **Firebase** authentication.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Database Setup (Neon)](#2-database-setup-neon)
3. [Firebase Setup](#3-firebase-setup)
4. [Render Deployment](#4-render-deployment)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Post-Deployment Checklist](#6-post-deployment-checklist)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

Before you begin, make sure you have:

- A **GitHub** account (to push the repo)
- A **Firebase** project with Google Sign-In enabled
- A **Neon** account for the PostgreSQL database (free at [neon.tech](https://neon.tech))
- *(Optional)* A **Resend** account for email notifications ([resend.com](https://resend.com))

---

## 2. Database Setup (Neon)

1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Create a new project (e.g., `splitnice`).
3. Copy the **connection string** from the dashboard. It will look like:
   ```
   postgresql://user:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this — you'll use it as the `DATABASE_URL` environment variable.

> **Note**: The app automatically converts `postgresql://` to `postgresql+psycopg://` at runtime, so you can paste the Neon URL as-is.

---

## 3. Firebase Setup

### 3.1 Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (or use an existing one).
3. Enable **Google Sign-In**:
   - Navigate to **Authentication** → **Sign-in method**.
   - Enable **Google** as a sign-in provider.

### 3.2 Get Frontend Config (VITE_ variables)

1. In the Firebase Console, go to **Project Settings** → **General**.
2. Under **Your apps**, click **Add app** → **Web** (</>) if you haven't already.
3. Copy the Firebase config object. You need these values:

| Firebase Config Key  | Environment Variable              |
|----------------------|-----------------------------------|
| `apiKey`             | `VITE_FIREBASE_API_KEY`           |
| `authDomain`        | `VITE_FIREBASE_AUTH_DOMAIN`       |
| `projectId`         | `VITE_FIREBASE_PROJECT_ID`        |
| `storageBucket`     | `VITE_FIREBASE_STORAGE_BUCKET`    |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| `appId`             | `VITE_FIREBASE_APP_ID`            |
| `measurementId`     | `VITE_FIREBASE_MEASUREMENT_ID`    |

### 3.3 Get Backend Credentials (Service Account JSON)

1. In the Firebase Console, go to **Project Settings** → **Service accounts**.
2. Click **Generate new private key**. This downloads a JSON file.
3. Open the JSON file and copy its **entire contents**.
4. You'll paste this as the `FIREBASE_CREDENTIALS_JSON` environment variable on Render.

> **⚠️ CRITICAL**: Never commit this JSON file to Git. It's already in `.gitignore`.

### 3.4 Add Your Render Domain to Firebase

After deploying (Step 4), you **must** authorize your Render domain in Firebase:

1. Go to **Authentication** → **Settings** → **Authorized domains**.
2. Add your Render domain: `your-app-name.onrender.com`.

---

## 4. Render Deployment

### 4.1 Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/splitnice.git
git push -u origin main
```

### 4.2 Create a Render Web Service

1. Go to [render.com](https://render.com) and sign in.
2. Click **New** → **Web Service**.
3. Connect your GitHub repository.
4. Render will auto-detect the `render.yaml` file. If not, configure manually:

| Setting        | Value                                                             |
|----------------|-------------------------------------------------------------------|
| **Name**       | `splitnice`                                                       |
| **Environment**| `Python`                                                          |
| **Build Command** | `./build.sh`                                                  |
| **Start Command** | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

### 4.3 Set Environment Variables

Go to your Render service → **Environment** → **Environment Variables** and add each of the following:

#### Backend Variables

| Variable                    | Value                                          |
|-----------------------------|------------------------------------------------|
| `DATABASE_URL`              | Your Neon PostgreSQL connection string          |
| `FIREBASE_CREDENTIALS_JSON` | The full JSON content of your service account key |
| `SECRET_KEY`                | Any random string (e.g., `openssl rand -hex 32`) |
| `FRONTEND_URL`              | `https://your-app-name.onrender.com`            |
| `RESEND_API_KEY`            | Your Resend API key *(optional — mock emails without it)* |
| `PYTHON_VERSION`            | `3.11.6`                                        |

#### Frontend Variables (VITE_)

| Variable                          | Value                                 |
|-----------------------------------|---------------------------------------|
| `VITE_FIREBASE_API_KEY`           | From Firebase Console (Step 3.2)      |
| `VITE_FIREBASE_AUTH_DOMAIN`       | `your-project.firebaseapp.com`        |
| `VITE_FIREBASE_PROJECT_ID`        | Your Firebase project ID              |
| `VITE_FIREBASE_STORAGE_BUCKET`    | `your-project.firebasestorage.app`    |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console              |
| `VITE_FIREBASE_APP_ID`            | From Firebase Console                 |
| `VITE_FIREBASE_MEASUREMENT_ID`    | From Firebase Console *(optional)*    |

> **Important**: The `VITE_` variables are baked into the frontend at **build time**. If you change them, you must trigger a **manual deploy** (redeploy) on Render.

### 4.4 Deploy

Click **Manual Deploy** → **Deploy latest commit**. Render will:

1. Run `build.sh` (installs Python deps + builds the React frontend).
2. Start the FastAPI server which serves both the API and the React app.

The first deploy takes ~3-5 minutes. You can monitor progress in the **Logs** tab.

---

## 5. Environment Variables Reference

Here's the full list of all environment variables in one place:

```env
# Database (REQUIRED)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Firebase Backend (REQUIRED)
FIREBASE_CREDENTIALS_JSON='{"type":"service_account","project_id":"...",...}'

# App Security (REQUIRED)
SECRET_KEY=your-random-secret-key

# Frontend URL for CORS (REQUIRED for production)
FRONTEND_URL=https://your-app-name.onrender.com

# Email Service (OPTIONAL — prints mock emails to logs if not set)
RESEND_API_KEY=re_your_api_key

# Firebase Frontend (REQUIRED — baked at build time)
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXX
```

---

## 6. Post-Deployment Checklist

After your first successful deploy, verify these:

- [ ] Visit `https://your-app-name.onrender.com` — you should see the landing page
- [ ] Click **"Get Started with Google"** — Google Sign-In popup should appear
- [ ] After signing in, you should be redirected to the Dashboard
- [ ] Create a group and add an expense — verify balances update
- [ ] Open the chat in a group — verify WebSocket messages work
- [ ] Check `https://your-app-name.onrender.com/api/health` returns `{"status": "ok"}`

---

## 7. Troubleshooting

### "Google Sign-In popup closes immediately"
→ Add your Render domain (`your-app.onrender.com`) to **Firebase Console → Authentication → Settings → Authorized domains**.

### "401 Unauthorized" on API calls
→ Check that `FIREBASE_CREDENTIALS_JSON` is set correctly on Render. The JSON must be valid and from the same Firebase project as your frontend config.

### "WebSocket connection failed"
→ Render supports WebSockets on paid plans. On the free tier, WebSockets may have limited support. The chat will still work via polling on page refresh.

### Build fails at "npm run build"
→ Ensure all `VITE_FIREBASE_*` environment variables are set. They are required at build time.

### "CORS error" in browser console
→ Make sure `FRONTEND_URL` is set to your exact Render URL (e.g., `https://splitnice.onrender.com`).

### Database connection errors
→ Verify your `DATABASE_URL` from Neon is correct and includes `?sslmode=require`.

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│              Render Web Service          │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  FastAPI (uvicorn)              │   │
│   │  ├── /api/*  → REST endpoints  │   │
│   │  ├── /ws/*   → WebSockets      │   │
│   │  └── /*      → React SPA       │   │
│   └──────────────┬──────────────────┘   │
│                  │                      │
└──────────────────┼──────────────────────┘
                   │
          ┌────────▼────────┐
          │  Neon PostgreSQL │
          │  (Cloud DB)      │
          └─────────────────┘
```

The FastAPI backend serves the built React frontend as static files. In production, both run from the same domain — no separate frontend hosting needed.

---

*Project made by Jatain Kumar*
