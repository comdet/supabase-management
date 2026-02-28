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
        const { action, id } = await req.json();

        if (!action || id === undefined) {
            return NextResponse.json({ error: 'Action and process ID are required' }, { status: 400 });
        }

        const validActions = ['restart', 'stop', 'delete', 'reload'];
        if (!validActions.includes(action)) {
            return NextResponse.json({ error: 'Invalid PM2 action' }, { status: 400 });
        }

        // Execute specific PM2 command for the target ID
        const command = `npx pm2 ${action} ${id} && npx pm2 save --force`;
        const { stdout, stderr } = await execAsync(command);

        return NextResponse.json({
            success: true,
            message: `Successfully executed ${action} on process ${id}`,
            stdout
        });

    } catch (error: any) {
        console.error('PM2 Action Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to execute PM2 action' }, { status: 500 });
    }
}
