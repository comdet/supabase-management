# 🧠 Supabase Manager - Architecture Context (For AI & Maintainers)

This document is intended for AI coding assistants, open-source contributors, maintainers, and developers to rapidly understand the core architecture, design patterns, and context of the **Supabase Manager** project.

---

## 🏗 System Architecture Overview

This project is a monolithic **Next.js 15 (App Router)** application that serves both the aesthetically pleasing Frontend Dashboard and the intensive Backend API routes executing host system-level operations.

### Core Tech Stack:
- **Frontend**: Next.js (React Server & Client Components), Tailwind CSS v3, Radix/Lucide icons, Recharts for monitoring gauges.
- **Backend**: Next.js API Routes (Node.js runtime environment). 
- **Database**: SQLite3 (`management.db`) for storing admin credentials and user settings.
- **Real-time Server**: Custom Node.js HTTP Server running **Socket.io** alongside Next.js to broadcast real-time events (handling the Web Terminal emulator sessions).
- **Process Manager**: PM2 for daemonizing the production application and ensuring uptime.

---

## 📁 Directory Structure Breakdown

```text
supabase_manager/
├── server.js                # Custom Next.js Bootstrapper (Attaches Socket.IO to HTTP server)
├── package.json             # Core dependencies
├── management.db            # SQLite database file (auto-generated on spin-up)
├── src/
│   ├── lib/                 # Shared backend library helpers
│   │   ├── auth.ts          # JWT, Session handling, hashed password logic (SHA-256)
│   │   ├── db.ts            # SQLite client wrapper logic (`dbGet`, `dbRun`, `getSetting`, `setSetting`)
│   │   └── docker.ts        # dockerode instance initiator mapping to /var/run/docker.sock
│   │
│   ├── middleware.ts        # 🛡️ GLOBAL SECURITY: JWT & API Key Validator protecting /api and /dashboard routes
│   │
│   ├── app/
│   │   ├── api/             # 🟢 BACKEND: Node.js API Endpoints (Middleware protected)
│   │   │   ├── auth/        # Login/Logout controller. Checks SQLite credentials.
│   │   │   ├── backup/      # Scripts to execute pg_dump locally and tar zip volumes
│   │   │   ├── docker/      # Interacts with local Docker Daemon (Container lists, Logs, Volumes parsing)
│   │   │   ├── files/       # Host OS File Manager API (CRUD file ops securely mapping to a ROOT path)
│   │   │   ├── network/     # Port scanning utilizing `ss -tuln` output.
│   │   │   ├── settings/    # GET/POST configs to SQLite `settings` and `users` tables.
│   │   │   └── system/      # Cron jobs setup (`crontab -l`), PM2 status (`pm2 jlist`), and OS resources (`df -h`, `os` module)
│   │   │
│   │   ├── dashboard/       # 🔵 FRONTEND: UI Components & Next.js Pages
│   │   │   ├── layout.tsx   # Global Sidebar Navigation Frame
│   │   │   ├── page.tsx     # Main Live Dashboard (Gauges & Stats for OS + Docker status)
│   │   │   ├── backup/      # Backup Tables & Restore Actions UI
│   │   │   ├── containers/  # Docker Containers Live Monitor UI
│   │   │   ├── cron/        # UI to add/remove Cron Jobs directly into OS
│   │   │   ├── files/       # The React File Explorer component (@cubone UI)
│   │   │   ├── settings/    # Admin config UI (Reset password, change backup dir paths)
│   │   │   └── shell/       # Xterm.js Browser Terminal emulator connected to socket.io
│   │   │
│   │   └── login/           # Unauthenticated Landing Page form
```

---

## 🛡 Security & Authentication Flow (SQLite + JWT)

The security of this application centers around preventing unauthorized access to the massive system-level APIs it controls.

1. **Pre-Seeded Database**: When the server boots and loads `src/lib/db.ts`, it automatically attempts to create `.sqlite` tables. If the `users` table is empty, an admin user (`admin` / `admin`) is generated and hashed via SHA-256 for a frictionless quick start for the end-user (who is guided by UI to change it). Default paths for file managers and backups are also populated into the `settings` table.
2. **Login Attempt**: User logs in via `/login` -> hits `/api/auth/login`. The controller verifies the payload against the SQLite `users` table.
3. **Session Cookie**: If valid, an **HTTP-only, Lax JWT Cookie (`session`)** is crafted using the `jose` library (with `HS256` and the `JWT_SECRET` from `.env`) lasting 7 days.
4. **Middleware Protection**: `src/middleware.ts` intercepts **EVERY request** going to `/dashboard/*` and `/api/*` (excluding `/api/auth`). It decodes and verifies the JWT signature before passing the traffic down the Next.js tree. If a request is lacking a valid JWT and is targeting an `/api/` route, it rejects it with a `401 JSON`. If targeting a page route, it performs a 302 redirect back to `/login`.
5. **API Bypass keys (Cron Jobs)**: Internal automation requests (often made by OS cron jobs calling `curl http://localhost:3000/api/backup`) bypass JWT protection by sending an `x-api-key` header mapped strictly to the `.env`'s `CRON_SECRET`.

---

## ⚙️ Primary Functional Modules

### 1. Docker Module (`dockerode`)
Located in `/api/docker`. Relies strictly on the UNIX socket `/var/run/docker.sock` to interface with the host daemon. It bypasses bash CLI entirely to provide real JSON responses for Container lifecycle states, memory usage, and precise Volumes mapping.

### 2. Web Terminal Module (`node-pty` + `socket.io` + `xterm.js`)
Since Next.js is fundamentally Request-Response REST, it cannot maintain interactive bash sessions natively. 
- **Backend Component**: `server.js` overrides Next's native server initiation, instantiating `Socket.IO`. Upon a connection event on `terminal:start`, it spawns a raw bash binary locally via the `node-pty` native extension (pseudo-terminal). This ties the bash's raw output strictly to the websocket room.
- **Frontend Component**: `/dashboard/shell` uses `xterm.js` to render the GUI for terminal emulator behavior (ANSI coloring, cursor mapping). Strokes are sent via `socket.emit('terminal:data')`.
- *Note for developers:* Adjusting socket lifecycle hooks requires a full PM2 restart (`npm run build && npx pm2 reload supabase-manager`), standard Next.js hot reload does not capture changes to `server.js`.

### 3. Settings & File Manager Module (`/api/files` & SQLite)
The goal of the File manager is to visually represent areas of the Host OS, constrained to a predefined environment for security.
- **Data Source**: The root directory accessible by the file manager (`FILE_MANAGER_ROOT`) and the backup directory (`BACKUP_DIR`) are fetched directly from the `settings` table in SQLite.
- **Path Traversal Protection**: To mitigate directory traversal (`..` payload escapes), `/api/files/route.ts` runs a rigorous `resolveSafePath()` helper. It mandates that any requested `fs.stat` relative path, once normalized into an absolute path via `path.join()`, **MUST** `.startsWith(FILE_MANAGER_ROOT)`. Failure throws a hard 403.
- **Frontend File UI**: Rendered using `@cubone/react-file-manager`.

### 4. Background Server Restarting
Settings changed on the frontend (like the password or file manager roots) might optionally notify PM2 to restart via an HTTP signal `/api/system` (action: `restartApp`), invoking a delayed `npx pm2 reload <appName>`.

---

## 🧭 Roadmap / Known Missing Pieces (TODO)

- **Role Based Access Control (RBAC)**: Currently, only a single "Admin" tier exists via `id=1`. There is no concept of viewers vs. editors.
- **Localization (i18n)**: Expanding structural hooks for multiple language supports like Thai, Spanish, etc.
