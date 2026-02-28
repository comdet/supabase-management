# Changelog

## [1.1.4] - $(date +'%Y-%m-%d')

### ✨ Features & Enhancements
- **Hosting Dashboard**: Added a comprehensive `How NGINX Auto-Config Works` guide to the `/dashboard/hosting` page. This guide clarifies the deployment paths, the temporary storage of generated `.conf` files, and the necessary directory permissions (`www-data`) required for NGINX to serve the deployed files effectively.

## [1.1.3] - $(date +'%Y-%m-%d')

### 🐛 Bug Fixes & Refactoring
- **System Auto Updater**: 
  - Fixed an issue where Auto Update caused Next.js routing glitches (displaying old javascript code/APIs like `/api/system/cron` instead of newer pm2 endpoints) due to the caching mechanism. The API will now properly flush out and **delete the old `.next` runtime directory** entirely before extracting the new GitHub Action artifact.
  - Stopped using `npm install --omit=dev` inside the updater to prevent it from secretly wiping existing `node_modules` structure that often confuses manually managing users into thinking their builds were broken. 
  - Note: You **DO NOT** need to run `npm run build` server-side, as the GitHub Actions pipeline inherently packages a production-ready `.next` binary inside the `release.tar.gz`.

## [1.1.2] - $(date +'%Y-%m-%d')

### 🐛 Bug Fixes & Refactoring
- **PM2 Dashboard Module**: Fixed PM2 monitoring logic where the frontend erroneously routed PM2 checks to the generic `cron` endpoint. 
  - Restored full operational controls via a new backend API (`/api/system/pm2`) allowing users to **Start, Stop, Restart, and Delete** PM2 processes directly from the Web Interface as intended in the core design context.

## [1.1.1] - $(date +'%Y-%m-%d')

### 🐛 Bug Fixes & Refactoring
- **PM2 Dashboard**: Restored the missing `pm2` monitoring page which previously returned a 404 error after the layout redesign.

### ⚙️ Automation & Tooling
- **Release Workflow**: Updated the release automation workflow (`.agents/workflows`) to automatically bump the version badge within `README.md`.

## [1.1.0] - $(date +'%Y-%m-%d')

### ✨ Features
- **Auto Web Hosting**: Seamlessly pull `.tar.gz` releases from GitHub and deploy them directly into specified internal paths.
- **Docker Inspector**: Added deep container inspecting capabilities (`/api/docker/containers/[id]`) to view volumes, networks, and exact environment configurations with a new Modal UI.
- **Manual NGINX & Server Guides**: Introduced an instructions-based manual setup guide on the Terminal UI and Web Hosting Dashboard to mitigate `sudoers` risks.

### 🐛 Bug Fixes & Refactoring
- **Dynamic Config**: Refactored logic to securely sync `FILE_MANAGER_ROOT` and `BACKUP_DIR` with SQLite settings instead of relying solely on `.env`.
- **UI Architecture**: Moved and reorganized the left-hand Sidebar navigation menu structure for better usability.

### 📚 Documentation
- Updated `README.md` to document the newly supported deployment tunneling strategies (NGINX, Cloudflare, SSH Tunnel).
- Added Auto Web Hosting setup instructions and clarified security risks regarding Docker Daemons and system paths.
- Updated `context.md` architecture guide.
