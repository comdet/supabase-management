import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSetting } from '@/lib/db';

export async function GET() {
    try {
        const supabaseProjectPath = await getSetting('SUPABASE_PROJECT_PATH', '');

        if (!supabaseProjectPath) {
            return NextResponse.json({ error: 'Supabase Project Path is not configured in Settings.' }, { status: 400 });
        }

        const envPath = path.join(supabaseProjectPath, '.env');

        try {
            const content = await fs.readFile(envPath, 'utf-8');
            return NextResponse.json({ content });
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                return NextResponse.json({ error: 'No .env file found at the specified Supabase Project Path.' }, { status: 404 });
            }
            throw err;
        }

    } catch (error: unknown) {
        console.error('Supabase ENV GET error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Failed to read .env file' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { content } = await req.json();

        if (typeof content !== 'string') {
            return NextResponse.json({ error: 'Invalid content format.' }, { status: 400 });
        }

        const supabaseProjectPath = await getSetting('SUPABASE_PROJECT_PATH', '');

        if (!supabaseProjectPath) {
            return NextResponse.json({ error: 'Supabase Project Path is not configured in Settings.' }, { status: 400 });
        }

        const envPath = path.join(supabaseProjectPath, '.env');

        await fs.writeFile(envPath, content, 'utf-8');

        return NextResponse.json({ success: true, message: '.env file saved successfully.' });

    } catch (error: unknown) {
        console.error('Supabase ENV POST error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Failed to save .env file' }, { status: 500 });
    }
}
