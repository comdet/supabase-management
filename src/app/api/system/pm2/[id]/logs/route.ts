import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        let id: string;
        // Next.js 15: route segment params are typically wrapped in Promises
        if (context.params instanceof Promise) {
            const resolved = await context.params;
            id = resolved.id;
        } else {
            id = (context.params as { id: string }).id;
        }

        if (id === undefined) {
            return NextResponse.json({ error: 'Process ID is required' }, { status: 400 });
        }

        const { stdout, stderr } = await execAsync(`npx pm2 logs ${id} --lines 100 --nostream`);

        return NextResponse.json({
            logs: stdout || stderr || 'No logs found.'
        });
    } catch (error: any) {
        console.error('Error fetching PM2 logs:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch logs' }, { status: 500 });
    }
}
