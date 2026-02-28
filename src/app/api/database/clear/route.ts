import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
    try {
        const { confirm } = await req.json();

        if (confirm !== 'CLEAR_ALL') {
            return NextResponse.json({ error: 'Invalid confirmation string' }, { status: 400 });
        }

        const sql = `
            DROP SCHEMA public CASCADE;
            CREATE SCHEMA public;
            GRANT ALL ON SCHEMA public TO postgres;
            GRANT ALL ON SCHEMA public TO public;
        `;

        await execAsync(`docker exec supabase-db psql -U postgres -d postgres -c "${sql.replace(/\n/g, ' ')}"`);

        return NextResponse.json({ success: true, message: 'Database public schema cleared successfully.' });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
