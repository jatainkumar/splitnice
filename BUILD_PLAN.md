# BUILD_PLAN.md — Splitwise Clone

> Companion to AI_CONTEXT.md. This document is the execution roadmap.

---

## 1. Product Research

### How Splitwise Was Studied
- Reviewed Splitwise's core workflows: group creation, expense splitting (equal, unequal, percentage, shares), debt simplification, settlements
- Identified that Splitwise's web UI is subpar — opportunity to build a cleaner, more modern experience
- Studied the "add friend by contact, claim account later" flow
- Noted Splitwise's activity feed pattern (expenses appear as chat-like messages)

### Key Workflows Identified
1. **Sign up / Login** (Google OAuth or Email/Password)
2. **Create group** with friends (invite by mobile number)
3. **Add expense** with multiple split types and multiple payers
4. **View balances** (raw pairwise or simplified debts)
5. **Settle up** (full or partial, with payment method recorded)
6. **Chat** in group activity feed + comment on specific expenses
7. **Get notified** of group events + ping friends to settle

### Product Assumptions
- Max 6 users per group (demo constraint)
- Indian audience primary (INR default, mobile-first UX)
- No actual payment processing — settlements are manual records
- Exchange rates entered manually by user (no live API in MVP)

---

## 2. Architecture

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React (Vite) + Tailwind CSS v4 + Framer Motion |
| Routing | React Router v6 |
| Backend | Python + FastAPI |
| Database | PostgreSQL (Neon free tier) |
| Auth | Firebase Authentication (Google OAuth + Email/Password) |
| Real-Time | WebSockets (FastAPI native) |
| Email | Resend |
| Deployment | Render (single service — FastAPI serves React build) |
| Receipt Storage | Base64 in PostgreSQL |

### System Architecture Diagram
```
Browser (React SPA)
    |
    |--- HTTPS (REST API) ---> FastAPI Backend ---> PostgreSQL (Neon)
    |--- WSS (WebSocket) ----> FastAPI Backend
    |--- Firebase Auth ------> Firebase (Google OAuth / Email)
                                    |
                               FastAPI verifies Firebase token
                                    |
                               Resend (Email notifications)
```

### Database Schema (11 Tables)
Refer to AI_CONTEXT.md Section 7 for full schema. Summary:
- `users` — profile, Firebase UID, claimed/unclaimed status
- `groups` — name, description, simplify toggle, archive flag
- `group_members` — role (admin/member), invite status
- `expenses` — amount, currency, exchange rate, split type
- `expense_payers` — who paid and how much
- `expense_splits` — who owes and how much
- `settlements` — payer, payee, amount, payment method
- `balances` — running pairwise balance cache
- `chat_messages` — group chat + expense comments
- `notifications` — in-app notifications
- `ping_log` — settle-up reminders with 4-hour rate limit

### API Design
Refer to AI_CONTEXT.md Section 8 for full endpoint list. Summary:
- **Auth**: login, profile, me
- **Groups**: CRUD + member management + archive
- **Expenses**: CRUD (30-min edit/delete window)
- **Settlements**: create + list
- **Balances**: group + individual summary
- **Chat**: group messages + expense comments
- **Notifications**: list + mark read + ping
- **WebSocket**: `ws://{host}/ws/{group_id}` for real-time

### Frontend Structure
Refer to AI_CONTEXT.md Section 9. Component-based architecture with:
- Layout shell (sidebar, navbar, responsive)
- Auth pages (login, signup, profile setup)
- Dashboard (group list, friend list, balance summary)
- Group detail (chat-style feed, expenses, settlements)
- Modals (add expense, settle up)
- Common components (avatar, card, modal, toggle)

---

## 3. Priority Tiers (1-Day Constraint)

Given **1 day** of build time, features are prioritized into tiers:

### P0 — Must Ship (Core Loop)
These features make the app functional and demoable:

| # | Feature | Est. Time |
|---|---------|-----------|
| 1 | Project scaffolding (Vite + FastAPI + Neon DB) | 30 min |
| 2 | Database schema (all 11 tables, migrations) | 30 min |
| 3 | Firebase Auth integration (Google + Email login) | 45 min |
| 4 | Landing page + auth flow UI | 30 min |
| 5 | User profile setup (post-login) | 20 min |
| 6 | Groups CRUD (create, list, view, settings) | 45 min |
| 7 | Group member management (invite, accept, remove) | 30 min |
| 8 | Add expense (all 4 split types, multiple payers) | 60 min |
| 9 | Balance calculation engine | 45 min |
| 10 | Balance display (group + individual summary) | 20 min |
| 11 | Settle up (full/partial, payment method) | 30 min |
| **P0 Total** | | **~6 hrs** |

### P1 — Should Ship (Differentiators)
These make the app feel complete:

| # | Feature | Est. Time |
|---|---------|-----------|
| 12 | Real-time group chat (WebSocket) | 45 min |
| 13 | Expense comment thread | 20 min |
| 14 | Debt simplification algorithm | 30 min |
| 15 | Dark/Light mode toggle | 20 min |
| 16 | Responsive sidebar + mobile layout | 30 min |
| 17 | In-app notifications | 30 min |
| **P1 Total** | | **~3 hrs** |

### P2 — Nice to Have
Ship if time permits:

| # | Feature | Est. Time |
|---|---------|-----------|
| 18 | Multi-currency support | 20 min |
| 19 | Unclaimed user flow (add by mobile, claim later) | 30 min |
| 20 | Receipt image upload (base64) | 20 min |
| 21 | Group archive + permanent delete | 20 min |
| 22 | Push email notifications (Resend) | 30 min |
| 23 | Ping to settle (with 4-hour rate limit) | 20 min |
| 24 | 30-min edit/delete window for expenses | 15 min |
| 25 | Framer Motion polish (page transitions, micro-animations) | 30 min |
| **P2 Total** | | **~3 hrs** |

### Deployment (Built Into Schedule)
| # | Task | Est. Time |
|---|------|-----------|
| 26 | Render deployment setup | 20 min |
| 27 | Env vars, CORS, production config | 15 min |
| 28 | Smoke test deployed app | 15 min |
| **Deploy Total** | | **~50 min** |

---

## 4. Execution Schedule (1 Day)

### Phase 1: Foundation (0-1.5 hrs)
- [ ] Scaffold Vite React app with Tailwind v4
- [ ] Scaffold FastAPI project with SQLAlchemy + Alembic
- [ ] Set up Neon PostgreSQL, run migrations (all 11 tables)
- [ ] Set up Firebase project (Google + Email auth)
- [ ] Verify: React app boots, FastAPI serves /health, DB connected

### Phase 2: Auth + Profile (1.5-2.5 hrs)
- [ ] Firebase Auth integration (frontend)
- [ ] `/api/auth/login` endpoint (verify Firebase token, upsert user)
- [ ] Landing page UI (premium dark theme, cursive logo)
- [ ] Post-login profile setup page
- [ ] Auth context + protected routes

### Phase 3: Groups (2.5-4 hrs)
- [ ] Groups CRUD API endpoints
- [ ] Group member management API
- [ ] Dashboard UI (group list + friend list)
- [ ] Create group modal
- [ ] Group detail page (shell)
- [ ] Member invite/accept/remove UI

### Phase 4: Expenses + Balances (4-6.5 hrs)
- [ ] Add expense API (all 4 split types, multiple payers)
- [ ] Balance calculation engine
- [ ] Expense creation UI (split type selector, payer selector)
- [ ] Balance display UI (group + individual)
- [ ] Settlement API + UI
- [ ] Activity feed (expenses as messages in group view)

### Phase 5: Real-Time + Chat (6.5-8 hrs)
- [ ] WebSocket endpoint for group chat
- [ ] Chat UI in group detail page
- [ ] Expense comment thread
- [ ] In-app notifications (bell icon, notification list)
- [ ] Debt simplification algorithm + toggle

### Phase 6: Polish + Deploy (8-10 hrs)
- [ ] Dark/Light mode toggle
- [ ] Responsive sidebar
- [ ] Framer Motion animations
- [ ] Multi-currency (if time permits)
- [ ] Render deployment
- [ ] Smoke test all flows
- [ ] README.md with setup instructions

---

## 5. AI Collaboration Process

### How the AI Was Instructed
- Assigned role of "junior engineer" — not allowed to assume or recommend
- Must ask questions and let the human think through decisions
- Must maintain AI_CONTEXT.md as single source of truth after every answer

### Interview Process
- 8 batches of questions covering:
  1. Product goals, Splitwise research, personas
  2. Authentication, user profiles, group management rules
  3. Expense creation, split types, edit/delete rules, settlements, chat
  4. Balance calculation, currency, UI screens, notifications
  5. Frontend framework, backend framework, database, API style
  6. Real-time mechanism, deployment, styling, email service
  7. Database schema review, API endpoint draft, testing, scope prioritization
  8. Tailwind version, design direction, routing, timeline, receipt storage

### How AI_CONTEXT.md Was Maintained
- Updated after every batch of answers
- Contains: product understanding, scope, all feature specifications, database schema, API design, frontend structure, deployment plan, testing plan, trade-offs, known limitations
- Any evaluator can paste AI_CONTEXT.md into the same AI tool and reproduce the app

---

## 6. Tradeoffs

| What We Simplified | Why | Impact |
|---------------------|-----|--------|
| Receipt storage as base64 | No external storage setup needed | Large DB rows; not scalable |
| Component state only (no Redux) | Faster development | Prop drilling in deep component trees |
| Manual exchange rate input | No live API integration needed | Less convenient for users |
| Minimal testing | 1-day timeline | Higher bug risk |
| Single Render deployment | Free, simple | Cold starts; service sleep |

| What We Would Improve With More Time |
|--------------------------------------|
| Move receipt images to Cloudinary or S3 |
| Add Redux/Zustand for global state management |
| Integrate live exchange rate API (e.g., Open Exchange Rates) |
| Add comprehensive API tests + frontend E2E tests |
| Add WebSocket reconnection logic with exponential backoff |
| Add pagination for expense/chat history |
| Add user avatar upload to cloud storage |
| PWA support for mobile installation |

---

## 7. Verification Plan

### Manual Testing Checklist
- [ ] Can sign up with Google
- [ ] Can sign up with Email/Password
- [ ] Can complete profile (mobile number)
- [ ] Can create a group
- [ ] Can invite members to a group
- [ ] Can accept/reject group invitations
- [ ] Can add expense with each split type (equal, unequal, %, share)
- [ ] Can add expense with multiple payers
- [ ] Balances calculate correctly
- [ ] Can settle up (full and partial)
- [ ] Can toggle debt simplification per group
- [ ] Chat messages appear in real-time
- [ ] Expense comments work
- [ ] Dark/Light mode toggle works
- [ ] App is responsive on mobile viewport
- [ ] Deployed URL loads and functions

---

_Last updated: 2026-06-02_
