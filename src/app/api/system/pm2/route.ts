import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        const { stdout } = await execAsync('npx pm2 jlist');
        const processes = JSON.parse(stdout || '[]');
        return NextResponse.json({ pm2: processes });
    } catch (error: any) {
        console.error('Error fetching PM2 status:', error);
        return NextResponse.json({ error: 'Failed to fetch PM2 data' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { action, id, name, command: startCmd } = await req.json();

        if (!action) {
            return NextResponse.json({ error: 'Action is required' }, { status: 400 });
        }

        if (action !== 'start' && id === undefined) {
            return NextResponse.json({ error: 'Process ID is required' }, { status: 400 });
        }

        const validActions = ['restart', 'stop', 'delete', 'reload', 'start'];
        if (!validActions.includes(action)) {
            return NextResponse.json({ error: 'Invalid PM2 action' }, { status: 400 });
        }

        let pm2Command = '';
        if (action === 'start') {
            if (!startCmd) {
                return NextResponse.json({ error: 'Command is required for starting a process' }, { status: 400 });
            }
            const nameFlag = name ? `--name "${name}"` : '';
            // For PM2 we run the command directly when starting
            pm2Command = `npx pm2 start "${startCmd}" ${nameFlag} && npx pm2 save --force`;
        } else {
            // Execute specific PM2 command for the target ID
            pm2Command = `npx pm2 ${action} ${id} && npx pm2 save --force`;
        }

        const { stdout, stderr } = await execAsync(pm2Command);

        return NextResponse.json({
            success: true,
            message: `Successfully executed ${action} ${id !== undefined ? `on process ${id}` : ''}`,
            stdout
        });

    } catch (error: any) {
        console.error('PM2 Action Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to execute PM2 action' }, { status: 500 });
    }
}
