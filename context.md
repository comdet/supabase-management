# 🧠 Supabase Manager - Architecture Context (For AI & Maintainers)

This document is intended for AI coding assistants, open-source contributors, maintainers, and developers to rapidly understand the core architecture, design patterns, and context of the **Supabase Manager** project.

---

## 🏗 System Architecture Overview

This project is a monolithic **Next.js 15 (App Router)** application that serves both the aesthetically pleasing Frontend Dashboard and the intensive Backend API routes executing host system-level operations.

### Core Tech Stack:
- **Frontend**: Next.js (React Server & Client Components), Tailwind CSS v4, shadcn/ui components, Radix/Lucide icons, Recharts for monitoring gauges.
- **Backend**: Next.js API Routes (Node.js runtime environment). 
- **Database**: SQLite3 (`management.db`) for storing admin credentials, project configurations (Web Hosting), and user settings.
- **Real-time Server**: Custom Node.js HTTP Server running **Socket.io** alongside Next.js to broadcast real-time events (handling the Web Terminal emulator sessions).
- **Process Manager**: PM2 for daemonizing the production application and ensuring uptime.

---

## 📁 Directory Structure Breakdown

```text
supabase_manager/
├── server.js                # Custom Next.js Bootstrapper (Attaches Socket.IO to HTTP server)
├── package.json             # Core dependencies (Auto-updated via CI/CD Github tags)
├── management.db            # SQLite database file (auto-generated on spin-up)
├── src/
│   ├── components/          # Reusable React UI Components (shadcn/ui, Layouts, etc.)
│   ├── lib/                 # Shared backend library helpers
│   │   ├── auth.ts          # JWT, Session handling, hashed password logic (SHA-256)
│   │   ├── db.ts            # SQLite wrapper (`dbGet`, `dbRun`, `getSetting`, DB migrations)
│   │   └── docker.ts        # dockerode instance initiator mapping to /var/run/docker.sock
│   │
│   ├── middleware.ts        # 🛡️ GLOBAL SECURITY: JWT & API Key Validator protecting API & UI
│   │
│   ├── app/
│   │   ├── api/             # 🟢 BACKEND: Node.js API Endpoints (Middleware protected)
│   │   │   ├── auth/        # Login/Logout controller. Checks SQLite credentials.
│   │   │   ├── backup/      # Scripts to execute pg_dump locally and tar zip volumes
│   │   │   ├── docker/      # Interacts with local Docker Daemon (List, Logs, Volumes parsing)
│   │   │   ├── files/       # Host OS File Manager API (CRUD file ops securely mapping to a ROOT path)
│   │   │   ├── hosting/     # 🌐 Web Hosting Deployer (GitHub release fetcher & tarball extractor)
│   │   │   ├── network/     # Port scanning utilizing `ss -tuln` output.
│   │   │   ├── settings/    # GET/POST configs to SQLite `settings` table.
│   │   │   └── system/      # Cron jobs setup(`crontab -l`), PM2 status(`pm2 jlist`), Update module, NGINX control.
│   │   │
│   │   ├── dashboard/       # 🔵 FRONTEND: UI Components & Next.js Pages
│   │   │   ├── layout.tsx   # Global Sidebar Navigation Frame
│   │   │   ├── page.tsx     # Main Live Dashboard (Gauges & Stats for OS + Docker status)
│   │   │   ├── backup/      # Backup Tables & Restore Actions UI
│   │   │   ├── containers/  # Docker Containers Live Monitor UI
│   │   │   ├── cron/        # UI to add/remove Cron Jobs directly into OS
│   │   │   ├── files/       # The Web File Explorer component (@cubone UI)
│   │   │   ├── hosting/     # Project manager + Deployment panel for Web Hosting integration
│   │   │   ├── settings/    # Admin config UI (Reset password, root path toggles)
│   │   │   ├── shell/       # Xterm.js Browser Terminal emulator connected to socket.io
│   │   │   └── update/      # Software updater UI interfacing with GitHub Releases
│   │   │
│   │   └── login/           # Unauthenticated Landing Page form
```

---

## 🛡 Security & Authentication Flow (SQLite + JWT)

The security of this application centers around preventing unauthorized access to the massive system-level APIs it controls.

1. **Pre-Seeded Database**: When the server boots and loads `src/lib/db.ts`, it automatically attempts to create `.sqlite` tables (`users`, `settings`, `hosting_projects`). If empty, an admin user (`admin` / `admin`) is generated and hashed via SHA-256. 
2. **Login Attempt**: User logs in via `/login` -> hits `/api/auth/login`. Verified against the SQLite `users` table.
3. **Session Cookie**: If valid, an **HTTP-only, Lax JWT Cookie (`session`)** is crafted using `jose` with `HS256` lasting 7 days.
4. **Middleware Protection**: `src/middleware.ts` intercepts **EVERY request** going to `/dashboard/*` and `/api/*` (excluding `/api/auth`).
5. **API Bypass keys (Cron Jobs)**: Background daemons or `curl` calls can bypass JWT protection by sending an `x-api-key` header mapped strictly to the `.env`'s `CRON_SECRET`.

---

## ⚙️ Primary Functional Modules

### 1. Web Hosting & NGINX Automator (The Self-Hosted Vercel equivalent)
- **Database**: Tracks project names, domains, and GitHub repository links in SQLite.
- **Deploy Trigger**: `/api/hosting/deploy` connects to GitHub's raw API (with Optional Auth for Private Repos), downloads `.tar.gz` payload of a tagged release, extracts it natively using `tar --strip-components=1`, and plops it directly into the mapped destination web folder root.
- **NGINX Symlink Generator**: Creates standard Site configurations into `/etc/nginx/sites-available` and symlinks identically to `-enabled`. Safely issues a reload command utilizing host-level `sudo` (configured under `visudo`).

### 2. Auto-Update via GitHub CI/CD Pipeline
- **Continuous Integration**: When a developer tags a commit on GitHub, `release.yml` naturally creates an application bundle `build.tar.gz`.
- **System Action**: `/api/system/update` allows the dashboard UI to pull down its own latest build, unpack it entirely over the operating tree, runs `npm install --omit=dev` to bind fresh native drivers like `sqlite3` natively to the host OS C++ libraries, and systematically signals `pm2 reload` to restart itself.

### 3. Docker Module (`dockerode`) & Volume Control
Located in `/api/docker`. Relies strictly on the UNIX socket `/var/run/docker.sock` to interface with the host daemon. It bypasses bash CLI entirely to provide real JSON responses for Container lifecycle states, memory usage, and precise Volumes mapping.

### 4. Web Terminal Module (`node-pty` + `socket.io` + `xterm.js`)
- **Backend Component**: `server.js` overrides Next's native server initiation, instantiating `Socket.IO`. It spawns a raw bash binary locally via the `node-pty` native extension (pseudo-terminal). This ties the bash's raw output strictly to the websocket room.
- **Frontend Component**: `/dashboard/shell` uses `xterm.js` to render GUI interactive bash sessions natively.

### 5. Configs & File Manager Module (`/api/files`)
The goal of the File manager is to visually represent areas of the Host OS, constrained to a predefined environment for security.
- **Path Traversal Protection**: To mitigate directory traversal (`..` payload escapes), `/api/files/route.ts` runs a rigorous `resolveSafePath()` helper mapping back to `FILE_MANAGER_ROOT` in SQLite. Failure throws a hard 403.

---

## 🧭 Roadmap / Known Missing Pieces (TODO)

- **Role Based Access Control (RBAC)**: Currently, only a single "Admin" tier exists via `id=1`. There is no concept of viewers vs. editors.
- **Localization (i18n)**: Expanding structural hooks for multiple language supports like Thai, Spanish, etc.
