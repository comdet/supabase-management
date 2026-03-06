import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSetting } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { content } = body;

        if (typeof content !== 'string') {
            return NextResponse.json({ error: 'Content is required and must be a string.' }, { status: 400 });
        }

        const supabaseProjectPath = await getSetting('SUPABASE_PROJECT_PATH', '');

        if (!supabaseProjectPath) {
            return NextResponse.json({ error: 'Supabase Project Path is not configured in Settings.' }, { status: 400 });
        }

        const composePath = path.join(supabaseProjectPath, 'docker-compose.yml');

        // Check if the directory exists (or at least try to write. if the folder doesn't exist, we should throw)
        try {
            await fs.access(supabaseProjectPath);
        } catch (err) {
            return NextResponse.json({ error: 'Supabase Project directory does not exist or is not accessible.' }, { status: 404 });
        }

        // Write content to docker-compose.yml
        await fs.writeFile(composePath, content, 'utf-8');

        return NextResponse.json({ success: true, message: 'docker-compose.yml updated successfully' });
    } catch (error: unknown) {
        console.error('Save docker-compose error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Failed to save docker-compose.yml' }, { status: 500 });
    }
}
