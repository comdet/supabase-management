'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import io, { Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { TerminalSquare, AlertTriangle, ShieldAlert, BookOpen, X } from 'lucide-react';

export default function TerminalPage() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const [connected, setConnected] = useState(false);
    const [connectionError, setConnectionError] = useState('');
    const [showGuide, setShowGuide] = useState(false);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // 1. Initialize XTerm
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0c0c0c',
                foreground: '#cccccc',
                cursor: '#ff0055',    // Pinkish cursor
                selectionBackground: 'rgba(255, 0, 85, 0.3)',
                black: '#000000',
                red: '#c50f1f',
                green: '#13a10e',
                yellow: '#c19c00',
                blue: '#0037da',
                magenta: '#881798',
                cyan: '#3a96dd',
                white: '#cccccc',
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            lineHeight: 1.2
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Give a little welcome message
        term.writeln('\x1b[35m[Supabase Web Terminal]\x1b[0m Establishing secure connection to Host OS...');

        // 2. Initialize Socket.IO connection
        // Assuming current domain. In Dev it goes to localhost:3000 where our custom server.js listens
        const socket = io({
            path: '/api/socket.io',
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            setConnectionError('');
            term.writeln('\\x1b[32m[✓] Connected successfully to PTY socket.\\x1b[0m\\r\\n');
        });

        socket.on('connect_error', (err) => {
            setConnected(false);
            setConnectionError(err.message);
            term.writeln(`\\r\\n\\x1b[31m[x] Connection Failed: ${err.message}\\x1b[0m`);
        });

        socket.on('disconnect', () => {
            setConnected(false);
            term.writeln('\\r\\n\\x1b[31m[x] Disconnected from host.\\x1b[0m');
        });

        // 3. Pipe Data PTY -> Xterm
        socket.on('terminal.out', (data: string) => {
            term.write(data);
        });

        // 4. Pipe Data Xterm -> PTY
        term.onData((data) => {
            socket.emit('terminal.in', data);
        });

        // 5. Handle Resize
        const resizeObserver = new ResizeObserver(() => {
            try {
                fitAddon.fit();
                socket.emit('terminal.resize', { cols: term.cols, rows: term.rows });
            } catch (e) {
                // ignore
            }
        });

        resizeObserver.observe(terminalRef.current);

        return () => {
            resizeObserver.disconnect();
            socket.disconnect();
            term.dispose();
        };

    }, []);

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <TerminalSquare className="w-6 h-6 text-pink-500" /> Host OS Terminal
                    </h1>
                    <p className="text-neutral-400 text-sm mt-1">Directly execute commands on the underlying operating system (Ubuntu).</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <div className={`px-3 py-1 flex items-center gap-2 rounded-full text-xs font-medium border ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                        {connected ? 'Connected (Live)' : 'Disconnected'}
                    </div>

                    <button
                        onClick={() => setShowGuide(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-md transition-colors text-sm font-medium"
                    >
                        <BookOpen className="w-4 h-4" /> Setup Guide
                    </button>
                </div>
            </div>

            {/* Security Warning */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 flex items-start gap-4 shrink-0">
                <div className="bg-amber-500/20 p-2 rounded-lg mt-1">
                    <ShieldAlert className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                    <h3 className="text-amber-500 font-bold mb-1">Administrative Privileges Active</h3>
                    <p className="text-amber-400/80 text-sm">
                        You have root/sudo access to the host machine. Please exercise extreme caution. Commands executed here can permanently delete data, alter system configuration, and take down remote services offline.
                    </p>
                </div>
            </div>

            {connectionError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center gap-2 mb-4 shrink-0 shadow-sm">
                    <AlertTriangle className="w-5 h-5" /> {connectionError}
                </div>
            )}

            {/* Terminal Container */}
            <div className="flex-1 bg-black border border-neutral-800 rounded-xl overflow-hidden shadow-xl p-2 font-mono flex flex-col">
                <div className="w-full h-full min-h-[400px]" ref={terminalRef}></div>
            </div>

            {/* Barebone Guide Modal */}
            {showGuide && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-neutral-800 bg-neutral-950/50">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-blue-500" /> Barebone Server Setup Guide (Ubuntu)
                            </h2>
                            <button onClick={() => setShowGuide(false)} className="text-neutral-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 text-sm text-neutral-300 space-y-6">

                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">1. System Updates & Essential Tools</h3>
                                <div className="bg-black p-4 rounded-lg border border-neutral-800 font-mono text-emerald-400 text-xs">
                                    sudo apt update && sudo apt upgrade -y<br />
                                    sudo apt install -y curl wget git unzip htop ufw fail2ban nginx software-properties-common
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">2. Security Hardening (Firewall & Fail2Ban)</h3>
                                <p className="text-neutral-400 mb-2">Configure UFW to block everything except SSH, HTTP, and HTTPS.</p>
                                <div className="bg-black p-4 rounded-lg border border-neutral-800 font-mono text-blue-400 text-xs">
                                    sudo ufw default deny incoming<br />
                                    sudo ufw default allow outgoing<br />
                                    sudo ufw allow ssh<br />
                                    sudo ufw allow http<br />
                                    sudo ufw allow https<br />
                                    sudo ufw enable<br /><br />
                                    sudo systemctl enable fail2ban<br />
                                    sudo systemctl start fail2ban
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">3. Install Node.js (via NVM) & PM2</h3>
                                <div className="bg-black p-4 rounded-lg border border-neutral-800 font-mono text-fuchsia-400 text-xs">
                                    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash<br />
                                    source ~/.bashrc<br />
                                    nvm install 20<br />
                                    nvm use 20<br />
                                    nvm alias default 20<br />
                                    npm install -g pm2
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">4. Install Docker & Docker Compose</h3>
                                <div className="bg-black p-4 rounded-lg border border-neutral-800 font-mono text-amber-400 text-xs">
                                    curl -fsSL https://get.docker.com -o get-docker.sh<br />
                                    sudo sh get-docker.sh<br />
                                    sudo usermod -aG docker $USER<br />
                                    newgrp docker<br />
                                    docker --version
                                </div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl">
                                <h3 className="text-blue-400 font-bold mb-1 flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Post-Installation</h3>
                                <p className="text-sm text-neutral-300">
                                    Once all dependencies are installed, you can clone your Supabase Manager project, run `npm install`, `npm run build`, and daemonize it securely with `pm2 start npm --name "manager" -- start`. Ensure you place the manager behind NGINX as a Reverse Proxy with an SSL Certificate (Let's Encrypt / Certbot) for production safety.
                                </p>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
