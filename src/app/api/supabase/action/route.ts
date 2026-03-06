import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import { getSetting } from '@/lib/db';

const execPromise = promisify(exec);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action } = body; // 'up', 'down', 'pull'

        const validActions = ['up', 'down', 'pull'];
        if (!validActions.includes(action)) {
            return NextResponse.json({ error: 'Invalid action provided.' }, { status: 400 });
        }

        const supabaseProjectPath = await getSetting('SUPABASE_PROJECT_PATH', '');

        if (!supabaseProjectPath) {
            return NextResponse.json({ error: 'Supabase Project Path is not configured in Settings.' }, { status: 400 });
        }

        let command = '';
        switch (action) {
            case 'up':
                command = 'docker compose up -d';
                break;
            case 'down':
                command = 'docker compose down';
                break;
            case 'pull':
                command = 'docker compose pull';
                break;
        }

        try {
            // Load .env explicitly to ensure commands like docker compose get the correct variables
            // Standard exec does not load .env from the cwd automatically
            let parsedCustomEnv = {};
            try {
                const envContentBase = await fs.readFile(path.join(supabaseProjectPath, '.env'), 'utf-8');
                parsedCustomEnv = dotenv.parse(envContentBase);
            } catch (envError) {
                console.warn('Could not read or parse .env file in supabaseProjectPath. Fallback to default env.', envError);
            }

            const mergedEnv = { ...process.env, ...parsedCustomEnv };

            const { stdout, stderr } = await execPromise(command, {
                cwd: supabaseProjectPath,
                env: mergedEnv
            });
            return NextResponse.json({
                success: true,
                message: `Command executed successfully.`,
                output: stdout || stderr // docker compose sometimes writes to stderr even on success
            });
        } catch (execError: unknown) {
            console.error(`Error executing ${command}:`, execError);
            const err = execError as { message: string; stderr?: string; stdout?: string };
            return NextResponse.json({
                error: `Command failed: ${err.message}`,
                details: err.stderr || err.stdout
            }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error('Supabase Action POST error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Failed to execute action' }, { status: 500 });
    }
}
