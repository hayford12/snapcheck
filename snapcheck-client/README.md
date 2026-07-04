# SnapCheck — React Frontend

## Quick Start

### 1. Install dependencies
```bash
cd snapcheck-client
npm install
```

### 2. Start the dev server
```bash
npm run dev
```
Open http://localhost:5173

> The Vite proxy in `vite.config.js` forwards all `/api/*` calls to
> `http://localhost:5000` — so the backend must be running for API calls to work.
> The UI itself will load without the backend.

---

## Project Structure

```
src/
├── api/
│   ├── axios.js          ← Axios instance + 401 interceptor
│   └── services.js       ← All API call functions, grouped by resource
│
├── context/
│   └── AuthContext.jsx   ← Login, logout, JWT storage, role-based redirect
│
├── components/
│   ├── layout/
│   │   └── AppLayout.jsx ← Topbar + sidebar shell (role-aware nav)
│   ├── shared/
│   │   └── ProtectedRoute.jsx ← Guards routes by auth + role
│   └── ui/
│       ├── index.jsx     ← Badge, Modal, StatCard, PageHeader, Tabs, Spinner...
│       └── NotificationPanel.jsx
│
├── pages/
│   ├── shared/
│   │   └── LoginPage.jsx
│   ├── submitter/
│   │   ├── MySubmissionsPage.jsx   ← List, filter, status tabs
│   │   ├── NewSubmissionModal.jsx  ← App picker → questionnaire → upload
│   │   └── SubmissionDetailModal.jsx
│   ├── manager/
│   │   └── ApprovalsPage.jsx       ← Pending queue + review modal
│   └── riskteam/
│       ├── DashboardPage.jsx
│       ├── RCApprovalsPage.jsx     ← R&C final review + risk rating
│       ├── AllSubmissionsPage.jsx
│       ├── RepositoryPage.jsx
│       ├── AuditPage.jsx
│       ├── ReportsPage.jsx
│       ├── QuestionLibrary.jsx     ← Per-app question editor
│       └── AdminPage.jsx           ← Users, apps, settings
│
├── utils/
│   └── helpers.js        ← cn(), formatDate, getInitials, STATUS maps...
│
├── App.jsx               ← All routes, role guards, lazy loading
├── main.jsx              ← React root, QueryClient, Toaster
└── index.css             ← Tailwind + custom component classes
```

---

## Role → Landing Page

| Role       | Landing page    | Available pages                              |
|------------|-----------------|----------------------------------------------|
| SUBMITTER  | /submissions    | /submissions only                            |
| MANAGER    | /approvals      | /approvals only                              |
| RISK_TEAM  | /dashboard      | All pages including /admin and /questions    |

---

## Environment Variables

| Variable       | Value                        |
|----------------|------------------------------|
| VITE_API_URL   | http://localhost:5000/api    |

---

## Build for production

```bash
npm run build
# Output goes to dist/
# Serve dist/ with nginx or any static file server
```

---

## Next Steps

1. Set up the Node.js backend (`/server`)
2. Run Prisma migrations to create the database schema
3. Seed the database with applications and a test user
4. Replace the mock data in `NotificationPanel` and `DashboardPage`
   with real API calls once the backend is ready
5. Implement the remaining RC pages:
   - `RCApprovalsPage` — R&C final review + risk rating
   - `AllSubmissionsPage` — searchable table of all submissions
   - `RepositoryPage` — evidence file browser
   - `AuditPage` — immutable audit log
   - `ReportsPage` — export to Excel/PDF
   - `QuestionLibrary` — per-app question CRUD
   - `AdminPage` — user management, app config, email settings
