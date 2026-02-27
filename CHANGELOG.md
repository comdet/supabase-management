# Changelog

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
