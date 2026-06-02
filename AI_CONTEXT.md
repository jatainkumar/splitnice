# AI_CONTEXT.md — Splitwise Clone (Spreetail Internship Assignment)

> **This file is the single source of truth for the entire project.**  
> Another evaluator should be able to paste this into the same AI tool and recreate a similar app.

---

## 1. Product Understanding

_Status: Interview COMPLETE — All 8 batches done. Ready for BUILD_PLAN.md_

### 1.1 Product Goals
- **Audience**: Both evaluator/demo AND personal daily use (Indian market)
- **One-liner**: "A web app that mimics Splitwise functionality for free — letting users split bills equally or unequally among groups of people"
- **Key motivation**: Splitwise's free tier is limited; this clone provides the same core value without paywalls

### 1.2 Splitwise Research
- The current Splitwise **web UI is considered poor** — opportunity to build a better UX
- Core Splitwise concept: expenses can be split across groups or between individual friends
- Splitwise supports "simplify debts" — **this app will too, as a user-toggleable option**
- Splitwise uses email for verification; this app targets Indian audience
- Opportunity: build a cleaner, more modern UI than Splitwise's current web experience

### 1.3 Target Users / Personas
- **Primary**: Indian users splitting everyday expenses (roommates, friend groups, travel)
- **Demo context**: Evaluator testing the app during assessment
- **Max group size**: 6 users (demo constraint for simplicity)

### 1.4 Key Early Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Debt simplification | Optional (user toggle) | Give users control |
| Individual (non-group) expenses | In scope | Matches Splitwise behavior |
| Account claiming | Yes — add by mobile, claim later | Better UX for inviting friends |
| Authentication | Google OAuth via Firebase | Simplifies auth; 3-day timeline |
| Hosting/Deployment | Firebase (full platform) | Auth + hosting in one place |
| Max group size | 6 | Demo simplicity |
| Group deletion | Only when all settled; archive first | Protect data integrity |

---

## 2. Product Scope

### 2.1 MVP Features (In Scope)
From assignment requirements:
- Login module (Google OAuth via Firebase)
- Create and manage groups (invite, add, remove users)
- Create and manage expenses
  - Split equally, unequally, by percentage, by share
  - User chat in an expense (real-time updates)
  - Group-wise balances and individual balance summary
  - Settle debts / record payments
- Relational DB only
- Group archival system
- Unclaimed user support (add by mobile, claim later)

### 2.2 Out-of-Scope Features
- TBD (to be discussed)

---

## 2A. Authentication

### Login Method
- **Google OAuth** via Firebase Authentication
- User can log in with their Google account
- On first login, user is prompted to complete their profile (mobile number, etc.)

### Unclaimed Users
- A user can be added to a group by mobile number before they sign up
- Unclaimed users are visually distinguished (e.g., star icon or badge)
- Unclaimed users **can accumulate debts** — balances are tracked even before they log in
- When they sign up and verify their mobile number, the unclaimed record is linked to their real account

---

## 2B. User Profile

| Field | Required? | Source |
|-------|-----------|--------|
| Name | Yes | Google account (editable) |
| Email | Yes | Google account (auto-filled) |
| Mobile Number | Yes | User input (used for identity matching) |
| Profile Picture | Optional | Google account or upload |
| Currency Preference | Optional | User setting (default: INR) |

- Users can log in via **Google email**
- Mobile number is collected post-login for friend-matching and unclaimed account linking

---

## 2C. Groups

### Group Metadata
| Field | Required? |
|-------|-----------|
| Name | Yes |
| Description | Optional |
| Group Photo | Optional |

### Group Rules
| Rule | Behavior |
|------|----------|
| Who can create a group? | Any logged-in user |
| Who can add/remove members? | Only group creator (admin) |
| Can a user leave on their own? | No — must request admin |
| Invitation flow | Admin sends invite → user accepts/rejects |
| Remove with unsettled balance? | **Blocked** — must settle first |
| Leave with unsettled balance? | **Blocked** — must settle first |
| Can a group be deleted? | Only when **all balances are settled** |
| What happens on deletion? | Moved to **Archive** (soft delete) |
| Permanent deletion? | Only from the Archive section |
| Max members per group | 6 |

---

## 2D. Expenses

### Expense Creation Fields
| Field | Required? | Notes |
|-------|-----------|-------|
| Description / Title | Optional | Free text |
| Total Amount | Yes | Numeric |
| Paid By | Yes | Single payer OR multiple payers (each with their paid amount) |
| Split Among | Yes | Select group members; choose split type |
| Date | Auto | Timestamp at creation (not user-editable) |
| Receipt Image(s) | Optional | Upload photo of bill |

### Split Types
| Type | How It Works |
|------|--------------|
| Equal | Total ÷ number of selected people |
| Unequal | User manually types exact amount per person (must sum to total) |
| Percentage | User enters % per person (must sum to 100%) |
| By Share (Ratio) | User enters shares like 2:1:1; app calculates amounts |

### Multiple Payers
- An expense can have **multiple payers**, each with their own paid amount
- Example: "Dinner ₹800 — A paid ₹500, B paid ₹300"
- Sum of all payer amounts must equal the total expense

### Edit & Delete Rules
| Rule | Behavior |
|------|-----------|
| Edit window | **30 minutes** after creation only |
| Edit after 30 min | **Blocked** |
| Delete window | **30 minutes** after creation only |
| Delete after 30 min | **Blocked** — expense is permanent |
| Edit when partial settlement exists | Allowed within 30 min; difference between old and new split creates adjustment amounts |

---

## 2E. Settlements

### Settlement Flow
- User selects **one person** to settle with (one-at-a-time only)
- User can settle **full balance** or **partial amount**
- If debt simplification is ON, the person sees simplified debts and picks accordingly
- Settlement creates a record (not an expense — separate concept)

### Payment Methods
| Method | Sub-options |
|--------|-------------|
| Cash | — |
| UPI | GPay, PhonePe, Paytm, and other popular UPI apps |

- Payment method is recorded for reference ("how was this settled?")
- No actual payment integration — just a record

---

## 2F. Chat & Activity Feed

### Two Chat Contexts
1. **Expense Comment Thread**: Each expense has its own comment section (like "the actual bill was ₹520 not ₹500")
2. **Group Activity Feed / Chat**: 
   - A combined feed in the group view
   - Expenses appear as messages from the person who created them
   - Users can also send regular chat messages in this feed
   - Interleaved: expenses + chat messages in chronological order

### Real-Time Mechanism
- Use **Firebase Firestore real-time listeners** (free tier available)
- Both expense comments and group chat update in real-time
- Chat UI is on the **same page** as the splits/expenses view

---

## 3. Balance Calculation

### When Balances Are Computed
- On **every new expense** added
- On **every new settlement** recorded
- On **page reload**
- At **regular intervals** (polling or real-time listener)

### Calculation Approach
- Maintain **pairwise balances** between every pair of users in a group
- Each expense creates debits/credits between payer(s) and the split participants
- Settlements reduce the pairwise balance

### Debt Simplification
- **Per-group setting** (toggle ON/OFF at group level)
- When OFF: show raw pairwise balances ("A owes B ₹100, B owes C ₹50")
- When ON: minimize the number of transactions (e.g., A owes B ₹100, B owes C ₹100 → A owes C ₹100)
- Algorithm needed: **minimum cash flow / debt simplification** (graph-based)

---

## 3A. Currency

| Setting | Value |
|---------|-------|
| Default currency | **INR (₹)** |
| Multi-currency support | **Yes** |
| Conversion approach | User can enter expense in any currency |
| Exchange rate | Option 1: Use a **default/market rate** (API or hardcoded). Option 2: User enters **custom exchange rate** |
| Storage | All balances stored/computed in **INR** after conversion |

- The expense stores the original currency + original amount + the exchange rate used
- Balances are always in INR for consistency

---

## 4. Notifications

### In-App Notifications
| Event | Type |
|-------|------|
| Added to a group | Notification |
| New expense added | **Popup** (immediate) |
| Someone settled with you | Notification |

### Push Notifications (Email)
| Event | Push? |
|-------|-------|
| Added to a group | ✅ |
| Account created/set up | ✅ |
| Account deleted | ✅ |
| Removed from a group | ✅ |
| Group deleted | ✅ |

### "Ping to Settle" Feature
- Any user can **ping another user** via push notification/email to remind them to settle
- **Rate limit**: One ping per user resets every **4 hours**
- Prevents spam; encourages settlement

---

## 5. UI / Screens

### Screen Flow
```
Landing Page (login/signup)
  → Dashboard
      ├── Group List
      ├── Friend List
      └── Notifications
  → Group Detail (chat-style interface)
      ├── Activity Feed (expenses as messages + chat)
      ├── Expense Detail (with comment thread)
      ├── Add Expense
      ├── Settle Up
      └── Group Settings (members, simplify toggle, archive)
  → Profile Settings
      ├── Edit Profile
      ├── Currency Preference
      └── Dark/Light Mode Toggle
```

### Layout & Responsiveness
- **Responsive**: works on both desktop and mobile viewports
- **Desktop**: dynamic smooth sidebar (collapsible) + main content area
- **Mobile**: sidebar collapses to hamburger/drawer; card-based layout
- Inside a group: **chat-like interface** where expenses appear as messages

### Theming
- **Dark mode** and **Light mode** supported
- Toggle in **Profile Settings**
- User preference persisted

---

## 6. Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Frontend** | React (Vite) | SPA |
| **Animations / UI** | Framer Motion | Smooth transitions, polished UX |
| **Styling** | Tailwind CSS v4 | Utility-first CSS |
| **State Management** | React component state (useState/useContext) | Simple; demo scale |
| **Backend** | Python + FastAPI | REST API + WebSockets |
| **Database** | PostgreSQL | Relational DB (assignment requirement) |
| **DB Hosting** | Neon (free tier) | Managed Postgres |
| **Authentication** | Firebase Auth (Google OAuth) | Firebase used ONLY for auth |
| **Real-Time** | WebSockets (FastAPI native) | For chat + live notifications |
| **Email Notifications** | Resend | Push notification emails (settle reminders, group events) |
| **API Style** | REST + WebSocket | REST for CRUD, WS for real-time |
| **Deployment** | Render | Single platform for frontend + backend |

### Key Architecture Decisions
- **Firebase is ONLY for Google OAuth + Email/Password authentication** — no Firestore, no Firebase Hosting
- **All data** (users, groups, expenses, settlements, chat, notifications) stored in **PostgreSQL**
- **Render** hosts everything: FastAPI backend serves the React build as static files (single deployment)
- **WebSockets** via FastAPI for real-time chat and live notification updates
- **Receipt images** stored as base64 in PostgreSQL (simplest approach for 1-day timeline)
- **Routing**: React Router v6
- **Timeline**: 1 day

### Design System
| Element | Specification |
|---------|---------------|
| Theme | Modern, premium dark theme |
| Dark mode background | **Pure dark black** |
| Light mode | Reversed (white/light backgrounds) |
| Logo/Brand | **Cursive text** (no icon, no emoji) |
| Emojis | **NONE — no emojis anywhere in the app** |
| Colors | Premium, curated palette (golds, teals, or similar luxury tones) |
| Typography | Modern Google Font (e.g., Inter for body, cursive font for logo) |
| Animations | Framer Motion — smooth page transitions, hover effects, micro-interactions |

---

## 7. Database Schema

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| firebase_uid | VARCHAR | From Firebase Auth |
| name | VARCHAR | |
| email | VARCHAR (unique) | From Google/email login |
| mobile_number | VARCHAR (unique, nullable) | For friend matching + unclaimed linking |
| profile_picture_url | TEXT (nullable) | |
| currency_preference | VARCHAR | Default: 'INR' |
| theme_preference | VARCHAR | 'light' or 'dark' |
| is_claimed | BOOLEAN | Default: true; false for unclaimed users |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `groups`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | VARCHAR | |
| description | TEXT (nullable) | |
| group_photo_url | TEXT (nullable) | |
| created_by | UUID (FK → users) | Admin |
| simplify_debts | BOOLEAN | Default: false; per-group toggle |
| is_archived | BOOLEAN | Default: false |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `group_members`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| group_id | UUID (FK → groups) | |
| user_id | UUID (FK → users) | |
| role | ENUM | 'admin' or 'member' |
| invite_status | ENUM | 'pending', 'accepted', 'rejected' |
| joined_at | TIMESTAMP | |

#### `expenses`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| group_id | UUID (FK → groups) | |
| description | VARCHAR (nullable) | |
| total_amount | DECIMAL | |
| currency | VARCHAR | Default: 'INR' |
| exchange_rate | DECIMAL (nullable) | If foreign currency; rate to INR |
| split_type | ENUM | 'equal', 'unequal', 'percentage', 'share' |
| created_by | UUID (FK → users) | |
| created_at | TIMESTAMP | Used for 30-min edit window |
| updated_at | TIMESTAMP | |

#### `expense_payers`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| expense_id | UUID (FK → expenses) | |
| user_id | UUID (FK → users) | |
| amount_paid | DECIMAL | |

#### `expense_splits`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| expense_id | UUID (FK → expenses) | |
| user_id | UUID (FK → users) | |
| owed_amount | DECIMAL | Amount this user owes (in INR) |

#### `settlements`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| group_id | UUID (FK → groups) | |
| payer_id | UUID (FK → users) | Person paying the debt |
| payee_id | UUID (FK → users) | Person receiving payment |
| amount | DECIMAL | |
| payment_method | VARCHAR | 'cash', 'gpay', 'phonepe', 'paytm', etc. |
| created_at | TIMESTAMP | |

#### `balances` (running cache)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| group_id | UUID (FK → groups) | |
| from_user_id | UUID (FK → users) | Debtor |
| to_user_id | UUID (FK → users) | Creditor |
| amount | DECIMAL | Positive = from_user owes to_user |
| updated_at | TIMESTAMP | |

#### `chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| group_id | UUID (FK → groups) | |
| expense_id | UUID (FK → expenses, nullable) | If comment on specific expense |
| user_id | UUID (FK → users) | |
| message | TEXT | |
| created_at | TIMESTAMP | |

#### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK → users) | Recipient |
| type | VARCHAR | 'group_invite', 'expense_added', 'settlement', 'ping', 'group_removed', etc. |
| title | VARCHAR | |
| message | TEXT | |
| is_read | BOOLEAN | Default: false |
| created_at | TIMESTAMP | |

#### `ping_log`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| from_user_id | UUID (FK → users) | |
| to_user_id | UUID (FK → users) | |
| last_pinged_at | TIMESTAMP | For 4-hour rate limiting |

### Individual (Non-Group) Expenses
- When a user creates an expense with a friend **outside of any group**, the system **implicitly creates a 2-person group**
- This group functions like any other group but is visually presented as a friend-to-friend view
- The 2-person group is auto-named (e.g., "You & Rahul")

---

## 8. API Design (REST + WebSocket)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Verify Firebase token, create/fetch user |
| PUT | `/api/auth/profile` | Update user profile (mobile, name, etc.) |
| GET | `/api/auth/me` | Get current user profile |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?mobile=xxx` | Search user by mobile number |
| GET | `/api/users/{id}` | Get user profile |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups` | Create group |
| GET | `/api/groups` | List my groups (active + archived) |
| GET | `/api/groups/{id}` | Get group detail |
| PUT | `/api/groups/{id}` | Update group (name, description, photo, simplify toggle) |
| DELETE | `/api/groups/{id}` | Archive group (soft delete) |
| DELETE | `/api/groups/{id}/permanent` | Permanently delete from archive |
| POST | `/api/groups/{id}/members` | Invite/add member |
| DELETE | `/api/groups/{id}/members/{user_id}` | Remove member |
| PUT | `/api/groups/{id}/members/{user_id}` | Accept/reject invite |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups/{id}/expenses` | Create expense |
| GET | `/api/groups/{id}/expenses` | List group expenses |
| GET | `/api/expenses/{id}` | Get expense detail |
| PUT | `/api/expenses/{id}` | Edit expense (within 30 min) |
| DELETE | `/api/expenses/{id}` | Delete expense (within 30 min) |

### Settlements
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups/{id}/settlements` | Record settlement |
| GET | `/api/groups/{id}/settlements` | List group settlements |

### Balances
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/{id}/balances` | Get group balances (raw or simplified) |
| GET | `/api/users/me/balances` | Get overall balance summary across all groups |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/{id}/messages` | Get group chat history |
| GET | `/api/expenses/{id}/comments` | Get expense comments |
| POST | `/api/expenses/{id}/comments` | Add expense comment |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `ws://host/ws/{group_id}` | Real-time group chat + expense/settlement live updates |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get my notifications |
| PUT | `/api/notifications/{id}/read` | Mark as read |
| POST | `/api/notifications/ping/{user_id}` | Ping a user to settle (4-hour rate limit) |

---

## 9. Frontend Structure

```
src/
├── components/
│   ├── layout/         # Sidebar, Navbar, ResponsiveShell
│   ├── auth/           # LoginPage, SignupPage, ProfileSetup
│   ├── dashboard/      # GroupList, FriendList, BalanceSummary
│   ├── group/          # GroupDetail, GroupSettings, MemberList
│   ├── expense/        # AddExpense, ExpenseDetail, SplitSelector
│   ├── settlement/     # SettleUp, PaymentMethodPicker
│   ├── chat/           # ChatFeed, ExpenseComments, MessageInput
│   ├── notifications/  # NotificationBell, NotificationList
│   └── common/         # Avatar, Button, Modal, Card, Toggle
├── hooks/              # useWebSocket, useAuth, useBalances
├── services/           # api.js, firebase.js, websocket.js
├── context/            # AuthContext, ThemeContext
├── pages/              # Route-level page components
├── utils/              # formatCurrency, calculateSplits, etc.
└── App.jsx             # Router + layout
```

---

## 10. Deployment Plan

| Component | Platform | Details |
|-----------|----------|---------|
| Frontend (React) | Render | Static site OR served by FastAPI |
| Backend (FastAPI) | Render | Web service (free tier) |
| Database | Neon | PostgreSQL (free tier) |
| Auth | Firebase | Google OAuth + Email/Password |
| Email | Resend | Push notification emails |

### Deployment Approach
- **Single Render deployment**: FastAPI serves the React production build as static files
- Backend and frontend share one Render Web Service
- Neon PostgreSQL as external database (connection string in env vars)
- Firebase project for auth configuration
- Resend API key for email delivery

---

## 11. Testing Plan

- **Minimal testing** due to 3-day timeline
- Focus on **manual testing** of critical flows
- Optional: basic API tests for balance calculation logic (most critical algorithm)
- No frontend component tests
- Smoke test all major flows before deployment

---

## 12. Authentication (Updated)

### Login Methods
1. **Google OAuth** via Firebase Authentication
2. **Email/Password** via Firebase Authentication

- Both methods supported — user can choose
- On first login, user completes profile (mobile number required)
- Firebase token verified by FastAPI backend on every API call

---

## 13. Trade-offs

| Decision | Trade-off | Rationale |
|----------|-----------|----------|
| Receipt as base64 | Large DB rows, no CDN caching | Simplest for 1-day build; no external storage setup |
| Component state only | No global state; prop drilling for deep trees | Demo scale; avoids Redux/Zustand setup time |
| Minimal testing | Risk of bugs in production | 1-day timeline; manual testing only |
| All features attempted | Risk of incomplete features | User wants all features; prioritize P0 → P1 → P2 |
| Single Render deployment | Cold starts on free tier | Free; simple single-service architecture |
| Neon free tier | Connection limits, sleep after inactivity | Free; sufficient for demo |

## 14. Prompts & AI Responses
- Interview conducted across 8 batches (see conversation history)
- All product and engineering decisions recorded in this document
- BUILD_PLAN.md created as a companion document

## 15. Changes Made During Implementation
- (Will be updated during build)

## 16. Known Limitations
- Neon free tier: DB sleeps after 5 min inactivity (cold start delay)
- Render free tier: service sleeps after 15 min inactivity
- Receipt images as base64: not scalable, increases DB size
- No automated tests
- WebSocket connections may drop on Render free tier (reconnection logic needed)
- 4-hour ping rate limit stored in DB, not in-memory cache
- No actual payment integration — settlement is a manual record
- Exchange rate: no live API in MVP; user must enter manually or use a hardcoded default

---

_Last updated: 2026-06-02 — Interview COMPLETE. BUILD_PLAN.md in progress._
