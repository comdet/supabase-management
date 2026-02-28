import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getSetting } from '@/lib/db';

const execPromise = promisify(exec);

export async function GET() {
    try {
        const supabaseProjectPath = await getSetting('SUPABASE_PROJECT_PATH', '');

        if (!supabaseProjectPath) {
            return NextResponse.json({ error: 'Supabase Project Path is not configured in Settings.' }, { status: 400 });
        }

        const composePath = path.join(supabaseProjectPath, 'docker-compose.yml');

        try {
            const content = await fs.readFile(composePath, 'utf-8');
            return NextResponse.json({ content });
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                return NextResponse.json({ error: 'No docker-compose.yml file found at the specified Supabase Project Path.' }, { status: 404 });
            }
            throw err;
        }

    } catch (error: unknown) {
        console.error('Supabase Update GET error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Failed to read docker-compose.yml' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tag } = body;

        if (!tag || typeof tag !== 'string') {
            return NextResponse.json({ error: 'Invalid or missing image tag.' }, { status: 400 });
        }

        const supabaseProjectPath = await getSetting('SUPABASE_PROJECT_PATH', '');

        if (!supabaseProjectPath) {
            return NextResponse.json({ error: 'Supabase Project Path is not configured in Settings.' }, { status: 400 });
        }

        const composePath = path.join(supabaseProjectPath, 'docker-compose.yml');

        // 1. Read docker-compose.yml
        let content = '';
        try {
            content = await fs.readFile(composePath, 'utf-8');
        } catch (err: unknown) {
            console.error('Failed to read file:', err);
            return NextResponse.json({ error: 'Failed to read docker-compose.yml file.' }, { status: 500 });
        }

        // 2. Replace the studio image tag
        // Look for: image: supabase/studio:<something>
        // Replace with: image: supabase/studio:<new_tag>
        const updatedContent = content.replace(/image:\s*supabase\/studio:[^\s]+/g, `image: supabase/studio:${tag}`);

        if (content === updatedContent) {
            return NextResponse.json({ error: 'Could not find or replace the supabase/studio image tag in docker-compose.yml' }, { status: 400 });
        }

        // 3. Save docker-compose.yml
        await fs.writeFile(composePath, updatedContent, 'utf-8');

        // 4. Run update commands: pull, down, up -d
        const command = 'docker compose pull && docker compose down && docker compose up -d';

        try {
            const { stdout, stderr } = await execPromise(command, { cwd: supabaseProjectPath });
            return NextResponse.json({
                success: true,
                message: `Update cascade completed successfully.`,
                output: stdout || stderr
            });
        } catch (execError: unknown) {
            console.error(`Error executing update cascade:`, execError);
            const err = execError as { message: string; stderr?: string; stdout?: string };
            return NextResponse.json({
                error: `Command failed during update cascade: ${err.message}`,
                details: err.stderr || err.stdout
            }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error('Supabase Update POST error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Failed to process update' }, { status: 500 });
    }
}
