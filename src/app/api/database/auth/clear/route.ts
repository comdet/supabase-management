import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
    try {
        const { confirm } = await req.json();

        if (confirm !== 'CLEAR_AUTH') {
            return NextResponse.json({ error: 'Invalid confirmation string' }, { status: 400 });
        }

        // Wipe all users in auth schema
        const sql = `TRUNCATE auth.users CASCADE;`;

        await execAsync(`docker exec supabase-db psql -U postgres -d postgres -c "${sql}"`);

        return NextResponse.json({ success: true, message: 'All authentication records cleared successfully.' });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
