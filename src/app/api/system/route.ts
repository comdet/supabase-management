import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        // Fetch Cron Jobs
        let cronJobs: string[] = [];
        try {
            const { stdout } = await execAsync('crontab -l');
            cronJobs = stdout.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        } catch (e: any) {
            // Error code 1 usually means strictly "no crontab for user"
            if (e.code === 1) {
                cronJobs = [];
            } else {
                console.warn('Error reading crontab:', e);
            }
        }

        // Fetch PM2 processes (pm2 jlist outputs JSON format)
        let pm2Processes: any[] = [];
        try {
            const { stdout } = await execAsync('npx pm2 jlist');
            const data = JSON.parse(stdout || '[]');

            pm2Processes = data.map((proc: any) => ({
                id: proc.pm_id,
                name: proc.name,
                status: proc.pm2_env?.status || 'unknown',
                memory: proc.monit?.memory || 0,
                cpu: proc.monit?.cpu || 0,
                uptime: proc.pm2_env?.pm_uptime || 0,
                restarts: proc.pm2_env?.restart_time || 0
            }));
        } catch (e) {
            console.warn('Error fetching PM2 status:', e);
            // Ignore if PM2 is not installed or accessible
        }

        return NextResponse.json({
            cron: cronJobs,
            pm2: pm2Processes,
            cronSecret: process.env.CRON_SECRET || ''
        });

    } catch (error: any) {
        console.error('System Monitor error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch system data' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (body.action === 'restartApp') {
            // Trigger PM2 reload in the background
            // We use setTimeout so the API response can return immediately before the node process dies.
            setTimeout(() => {
                exec('npx pm2 reload supabase-manager', (error, stdout, stderr) => {
                    if (error) console.error('Restart failed:', error);
                    else console.log('PM2 restart signal sent:', stdout);
                });
            }, 1000);

            return NextResponse.json({ success: true, message: 'Restarting backend server...' });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: any) {
        console.error('System API Post Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to execute system command' }, { status: 500 });
    }
}
