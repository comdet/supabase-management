
## [2.2.5] - 2026-03-02

### 🐛 Bug Fixes & Refactoring
- **Database Clear Stability**: Added `.trim()` to SQL execution string to prevent potential whitespace issues in `docker exec` shells.
- **Cleanup**: Removed temporary repository release scripts and redundant development comments.

## [2.2.4] - 2026-03-02

### ✨ Features & Enhancements
- **Auth Table UX Overhaul**: Completely upgraded the Authentication Manager table to support massive user databases without freezing the browser. Implemented a robust client-side **Pagination** engine (15 users per page) and a real-time **Smart Search Bar** allowing administrators to instantly filter authentication records by either Email or UUID.

## [2.2.3] - 2026-03-02

### 🐛 Bug Fixes & Refactoring
- **Authentication JSON Parsing Hotfix**: Fixed a severe JSON parsing error (`Unexpected token '+'`) that crashed the Authentication Manager table. PostgreSQL's internal `psql` CLI was intrinsically line-wrapping overly long tuple payloads with a `+` symbol terminal break. Forced the output into `unaligned` execution mode (`-A`), guaranteeing strictly conformant un-wrapped JSON streams globally.

## [2.2.2] - 2026-03-02

### 🐛 Bug Fixes & Refactoring
- **Missing API Routes 404 Hotfix**: Fixed a critical build error in `v2.2.1` where the physical server-side folder relocations (`/api/auth-users` and `/api/functions`) silently failed to commit due to strict Windows filesystem daemon locks holding onto the original paths. The paths have been strictly recopied and synced properly into the repository, resolving all 404 backend errors immediately.

## [2.2.1] - 2026-03-02

### ⚙️ Stability & Architecture
- **App Router Restructuring**: Executed a comprehensive flattening of the Next.js `app` directory structure to vastly improve codebase discoverability. Decoupled the Authentication API (`/api/auth-users`) and Edge Functions API (`/api/functions`) from deeply nested domain routes, ensuring a cleaner 1-to-1 mapping with the dashboard user interface and standardizing global router module paths for significantly improved maintainability going forward.

## [2.2.0] - 2026-03-02

### ✨ Features & Enhancements
- **Supabase Authentication Manager**: Introduced a fully-featured Authentication Manager under the `Hosting & Projects` dashboard module. Administrators can now view real-time metrics (Emails, UUIDs, Last Sign In), securely create new users (hashing natively over `gen_salt('bf')` via PostgreSQL `pgcrypto` straight into the `auth.users` schema), carefully delete discrete users, or completely execute a global **"Wipe All Authenticators"** command natively simulating Supabase Studio UI.

### 🐛 Bug Fixes & Refactoring
- **Secure Integration**: Ensured that the Database Clear Public Schema feature cleanly isolates from `auth.users`, protecting identity components from straying into orphan states natively.

## [2.1.6] - 2026-03-02

### 🐛 Bug Fixes & Refactoring
- **Edge Functions Deployer**: Fixed a container restart synchronization bug. The endpoint now uses native `dockerode` instead of `child_process.exec` to reliably restart the `edge-runtime` container regardless of host OS pathing issues.
- **Database Migrations Tracking**: Resolved a "Pending" UI state desynchronization bug where SQL migrations executed successfully via `psql` without writing to the tracking table. The backend now exactly replicates natively the `supabase db push` orchestration to create `supabase_migrations.schema_migrations` and upsert the applied versions.
- **Database Wipe Desynchronization**: Dropping the public schema now perfectly drops the `supabase_migrations` tracking schema alongside it to ensure starting from a 100% clean state, eliminating silently ignored fresh migrations.
- **Artifact Protection**: Added robust ZIP file validation for Edge Functions and Database deploy targets. The UI explicitly filters dropdowns to prevent accidental selections (e.g., executing `functions.zip` inside the Database pg-runtime), and conditionally disables "Run Seed.sql" if no seed is physically bundled.

### ✨ Features & Enhancements
- **Native Release Notes Delivery**: The internal GitHub Actions automated release pipeline (`release.yml`) will now extract the corresponding release notes from `CHANGELOG.md` completely cleanly allowing seamless, formatted viewing straight from the web GitHub Release page!

## [2.1.5] - 2026-03-02

### 🐛 Bug Fixes & Refactoring
- **Functions & Database Deployer**: Standardized the deployment download mechanism to use `axios` instead of `fetch/curl`. This ensures consistent handling of GitHub API redirects (302) to AWS S3, by properly dropping the `Authorization` header and preventing `400/401 Unauthorized` errors.
- **Functions Deploy Key**: Fixed a severe logical key bug where Edge Functions deployer queried `SUPABASE_FUNCTIONS_PAT` instead of the global `GITHUB_ARTIFACTS_PAT` from the SQLite config, resulting in empty tokens.
- **Hosting Deployer Resiliency**: Restored a missing fail-safe block (`mkdirSync`) that caused deployments to crash with `No such file or directory` if the user manually wiped out their entire runtime `project` folder using `rm -rf`.

## [2.1.4] - 2026-03-02

### 🔒 Security Hotfixes
- **Hosting Deployer**: Resolved a severe vulnerability where the backend previously fetched the entire Source Code raw tarball (including `.env`) instead of the designated compiled `build.tar.gz` asset.
- **Asset Enforcement**: UI and API for Edge Functions and Database deployment are now rigidly restricted to only recognize `.zip` release artifacts to prevent accidental execution of mismatched tarballs.

### ✨ Features
- **Automated Deploy Setup**: The Web Hosting automated deployment now utilizes `rm -rf` on the destination directory before extracting to prevent orphaned garbage files, and actively applies `chgrp www-data` + `chmod g+rx` bindings, drastically reducing manual CLI overhead.

### 📚 Documentation
- **GitHub Actions Guide**: Expanded the `README.md` (Section 7) to include a full step-by-step example on how to properly compress and attach `build.tar.gz` artifacts in CI/CD pipelines.
- **Refined Permission Warning**: Clarified NGINX directory execution bindings for Parent Directories on the UI panel.

# Changelog

## [2.1.3] - $(date +'%Y-%m-%d')

### 🐛 Bug Fixes & Refactoring
- **NGINX Auto-Config Guide**: Updated the deployment instructions in the Hosting dashboard. Simple `chown` was insufficient for deploy paths located inside a user's `/home/` directory (causing 403 Forbidden errors). The guide now correctly advises adding the `www-data` user to the deployment group (`usermod -aG`) and granting group execute (`chmod g+x`) permissions so NGINX can traverse the home directory securely.

## [2.1.2] - $(date +'%Y-%m-%d')

### ✨ Features & Enhancements
- **Hosting Dashboard**: You can now **Edit** existing projects directly from the dashboard card. Just click the new gear/edit icon to update your Domain, Deploy Path, and Access Tokens without having to delete and recreate the project!

### 🐛 Bug Fixes & Refactoring
- **Private Repository Fetching**: Fixed a logic flaw where the `PAT` (Personal Access Token) was not being passed to the GitHub API when checking for releases. The backend now natively retrieves the secure token associated with your project directly from the database and decrypts/authorizes the request, allowing you to fetch and deploy private repositories seamlessly.
- **Dependencies**: Added missing `@monaco-editor/react` library to prevent build failures on the Supabase page.

## [1.1.5] - $(date +'%Y-%m-%d')

### 🐛 Bug Fixes & Refactoring
- **Missing Source Code Sync**: Fixed a critical issue where the previous CI/CD GitHub action releases (1.1.2 - 1.1.4) failed to push the real source code modifications (PM2 actions and Update mechanisms) to the repository. The workflow has been forcefully updated to `git add .` ensuring all subsequent backend and frontend code syncs properly.

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
