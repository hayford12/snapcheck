# SnapCheck — Backend API

Node.js + Express + Prisma + PostgreSQL

---

## First-time setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure your database

Open `.env` and update the `DATABASE_URL` line with your PostgreSQL credentials:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/snapcheck"
```

Common default setups:
- Password is blank:   `postgresql://postgres:@localhost:5432/snapcheck`
- Using a named user:  `postgresql://myuser:mypassword@localhost:5432/snapcheck`

The database `snapcheck` will be created automatically by Prisma.

### 3. Create tables and seed data
```bash
npm run setup
```

This runs two commands in sequence:
- `npx prisma db push` — creates all tables in PostgreSQL
- `node src/db/seed.js` — creates 3 test users and 12 applications with questions

### 4. Start the server
```bash
npm run dev
```

Server runs on **http://localhost:5000**

---

## Test accounts (created by seed)

| Email | Password | Role |
|---|---|---|
| submitter@company.com | password123 | Submitter |
| manager@company.com | password123 | Line Manager |
| risk@company.com | password123 | Risk & Compliance |

---

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | None | Login |
| GET | /api/auth/me | Any | Current user |
| GET | /api/applications | Any | List applications |
| GET | /api/questions/app/:id | Any | Questions for an app |
| GET | /api/submissions/mine | Any | My submissions |
| POST | /api/submissions | Any | Create submission |
| PUT | /api/submissions/:id/answers | Any | Save answers |
| POST | /api/submissions/:id/submit | Any | Submit for approval |
| GET | /api/approvals/pending | Manager/RC | Items to review |
| POST | /api/approvals/:id/manager-approve | Manager/RC | Manager approve |
| POST | /api/approvals/:id/manager-reject | Manager/RC | Manager reject |
| POST | /api/approvals/:id/rc-approve | RC | Final approval + risk rating |
| POST | /api/approvals/:id/rc-reject | RC | RC reject |
| POST | /api/evidence/:submissionId | Any | Upload files |
| GET | /api/evidence/submission/:id | Any | List files |
| GET | /api/evidence/:id/download | Any | Download file |
| GET | /api/dashboard/stats | RC | Dashboard stats |
| GET | /api/dashboard/activity | RC | Recent activity |
| GET | /api/audit | RC | Audit log |
| GET | /api/users | RC | List users |
| POST | /api/users | RC | Create user |

---

## Running alongside the frontend

Start both servers in separate terminals:

```bash
# Terminal 1 — backend (this folder)
npm run dev

# Terminal 2 — frontend (snapcheck-client folder)
npm run dev
```

Frontend at http://localhost:5173 — already proxies `/api/*` to port 5000.

---

## Useful commands

```bash
npm run db:studio    # Open Prisma Studio (visual database browser)
npm run db:seed      # Re-run seed (safe to run multiple times)
npm run db:push      # Push schema changes to database
```
