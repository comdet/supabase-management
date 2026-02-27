# Supabase Manager 🚀

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-orange.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.0.0-black?logo=next.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC?logo=tailwind-css)

A modern, comprehensive, and aesthetically pleasing web-based dashboard for managing self-hosted **Supabase** environments and generalized Docker/System infrastructures. Built entirely with Next.js 15 (App Router), React, and Tailwind CSS.

## ✨ Key Features

This project provides an all-in-one control center for your server.

**🐳 Docker Management**
* **Container Dashboard**: Start, stop, restart, and monitor real-time resource usage of Docker containers.
* **Live Logs Output**: Stream real-time logs from any Docker container directly in the browser.
* **Volume Manager**: View, backup, and restore Docker volumes intuitively.

**💽 System & OS Operations**
* **Web-Based Terminal Server**: Access a fully-featured shell environment right from your browser (powered by `node-pty` and `xterm.js`).
* **File Manager**: Explore, upload, download, move, copy, and delete system files via a Finder-like GUI.
* **Resource Monitor**: Beautiful Recharts-powered dial gauges displaying Live CPU, RAM, and Disk space usage.
* **Network & PM2 Monitor**: Track open network ports and PM2 node processes.

**⚙️ Automation & Backup**
* **Cron Job Scheduler**: Easily schedule, edit, and monitor recurring automated tasks (like volume snapshot/database backups).
* **Backup & Restore Hub**: Download `.tar.gz` backups locally or restore them with one click.


## 🛠 Tech Stack

* **Framework:** [Next.js (App Router)](https://nextjs.org/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) + Custom Glassmorphism Themes
* **Icons:** [Lucide React](https://lucide.dev/)
* **Charting:** [Recharts](https://recharts.org/)
* **File Manager Component:** [@cubone/react-file-manager](https://www.npmjs.com/package/@cubone/react-file-manager)
* **Terminal Emulator:** [Xterm.js](https://xtermjs.org/) + Socket.IO

---

## 🚀 Quick Start / Installation

### 1. Prerequisites
Ensure your host machine has the following tools installed:
* Node.js `v18+` or newer
* Docker & Docker Compose
* PM2 (optional, but recommended for daemonizing the web app)

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/supabase-manager.git
cd supabase-manager
```

### 3. Install Dependencies
```bash
npm install
# or
yarn install
```

### 4. Setup Environment Variables
Copy the `.env.example` file (if provided) or create a new `.env` file at the root:
```env
# Security
JWT_SECRET=generate_your_secure_random_string_here
CRON_SECRET=your_secret_key_for_cron_jobs
```

> **Note:** The default login credentials are `admin` / `admin`. You must change this password immediately via the **Settings UI** in the dashboard. Other configurations like `BACKUP_DIR` and `FILE_MANAGER_ROOT` are also managed directly from the dashboard and securely stored in the local SQLite database.

### 5. Build and Run (Production)
```bash
npm run build
npm start

# Alternatively, run via PM2 for background process:
# pm2 start npm --name "supabase-manager" -- start
```
The dashboard will be accessible at `http://localhost:3000`.

### 6. Auto Web Hosting Setup (Optional)
If you want to use the **Auto Web Hosting** feature (deploying sites directly from GitHub with automatic NGINX configuration), you need to grant the user running this application permission to manage NGINX without a password prompt.

1. Ensure NGINX is installed on your server: `sudo apt install nginx`
2. Open the sudoers file safely: `sudo visudo`
3. Add the following line at the end of the file (replace `your_username` with the user running this app via PM2, e.g., `ubuntu`):
   ```bash
   your_username ALL=(ALL) NOPASSWD: /usr/bin/mv, /usr/bin/ln, /usr/sbin/nginx, /bin/systemctl
   ```
This grants the application permission to move config files, create symlinks, test NGINX configuration, and reload the NGINX service autonomously when deploying a new website.

---

## 🔒 Security Warning

Because this dashboard grants full access to system files, docker daemons, and a terminal shell:
* **DO NOT** expose this dashboard to the public internet without putting it behind a strict reverse proxy (like Nginx/Traefik) with SSL and possibly an extra Layer of Basic Auth/VPN.
* Change your default `ADMIN_PASSWORD` immediately.

## 🤝 Contributing
Contributions, issues, and feature requests are always welcome! Feel free to check the [issues page](https://github.com/your-username/supabase-manager/issues).

## 📄 License
This project is [MIT licensed](LICENSE).
