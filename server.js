const { createServer } = require('http');
// url module is deprecated for parsing
const next = require('next');
const { Server } = require('socket.io');
const pty = require('node-pty');
const os = require('os');
const { jwtVerify } = require('jose');
require('dotenv').config({ path: '.env' }); // Make sure we load env vars before Next.js

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Bind to all interfaces 
const port = process.env.PORT || 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const host = req.headers.host || 'localhost';
            const parsedUrl = new URL(req.url || '/', `http://${host}`);
            const query = Object.fromEntries(parsedUrl.searchParams.entries());
            await handle(req, res, {
                pathname: parsedUrl.pathname,
                query: query
            });
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('Internal server error');
        }
    });

    const io = new Server(server, {
        path: '/api/socket.io',
        addTrailingSlash: false,
    });

    // Security Verification: Only allow logged in users to access WebSocket Terminal
    io.use(async (socket, next) => {
        try {
            const cookieHeader = socket.handshake.headers.cookie;
            if (!cookieHeader) {
                return next(new Error('Authentication error: No cookies provided'));
            }

            const cookies = {};
            cookieHeader.split(';').forEach(cookie => {
                const parts = cookie.split('=');
                cookies[parts[0].trim()] = (parts.slice(1).join('=')).trim();
            });

            const sessionCookie = cookies['session'];
            if (!sessionCookie) {
                return next(new Error('Authentication error: Missing session token'));
            }

            const secretKey = process.env.JWT_SECRET || 'super-secret-key-change-it-in-production';
            const encodedKey = new TextEncoder().encode(secretKey);
            await jwtVerify(sessionCookie, encodedKey, {
                algorithms: ['HS256'],
            });
            next(); // Valid!
        } catch (err) {
            next(new Error('Authentication error: Invalid session'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket.io] Client connected to terminal: ${socket.id}`);

        // ใช้อ่าน Shell เริ่มต้นจากเครื่อง โดนเฉพาะในกรณีของ MacOS ที่มักเรียกเป็น zsh โดยปริยาย
        const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            cwd: process.env.HOME || process.cwd(),
            env: process.env
        });

        // 1. Backend -> Frontend (Pty output -> Browser terminal)
        ptyProcess.onData((data) => {
            socket.emit('terminal.out', data);
        });

        // 2. Frontend -> Backend (Browser typing -> Pty input)
        socket.on('terminal.in', (data) => {
            ptyProcess.write(data);
        });

        // 3. Frontend -> Backend (Resize window)
        socket.on('terminal.resize', (size) => {
            if (size && size.cols && size.rows) {
                try {
                    ptyProcess.resize(size.cols, size.rows);
                } catch (e) {
                    console.error('Resize pty error', e);
                }
            }
        });

        // 4. Cleanup when client drops connection
        socket.on('disconnect', () => {
            console.log(`[Socket.io] Client disconnected: ${socket.id}, terminating process.`);
            try {
                ptyProcess.kill();
            } catch (err) { }
        });
    });

    server.listen(port, () => {
        console.log(`> App running on http://localhost:${port} using custom server.js (WebSockets enabled)`);
    });
});
