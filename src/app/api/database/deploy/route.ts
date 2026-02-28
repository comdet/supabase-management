import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db';

const execAsync = promisify(exec);

export async function GET() {
    try {
        const repoRow = db.prepare(`SELECT value FROM settings WHERE key = 'SUPABASE_FUNCTIONS_REPO'`).get() as unknown as { value: string };
        const patRow = db.prepare(`SELECT value FROM settings WHERE key = 'SUPABASE_FUNCTIONS_PAT'`).get() as unknown as { value: string };

        const repo = repoRow?.value;
        const pat = patRow?.value;

        if (!repo) {
            return NextResponse.json({ releases: [], repo: '' });
        }

        const headers: HeadersInit = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Supabase-Management-App',
        };

        if (pat) {
            headers['Authorization'] = `token ${pat}`;
        }

        const response = await fetch(`https://api.github.com/repos/${repo}/releases`, { headers });
        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}`);
        }

        const releases = await response.json();
        return NextResponse.json({ releases, repo });
    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { assetUrl } = await req.json();

        if (!assetUrl) {
            return NextResponse.json({ error: 'Asset URL is required' }, { status: 400 });
        }

        const patRow = db.prepare(`SELECT value FROM settings WHERE key = 'SUPABASE_FUNCTIONS_PAT'`).get() as unknown as { value: string };
        const pat = patRow?.value;

        const downloadPath = path.join('/tmp', 'database_artifact.zip');
        const extractPath = path.join('/tmp', 'database_artifact');

        // Download carefully, using PAT if present
        let curlCmd = `curl -L -o ${downloadPath} "${assetUrl}"`;
        if (pat) {
            // Use API header to download asset natively
            curlCmd = `curl -L -H "Authorization: token ${pat}" -H "Accept: application/octet-stream" -o ${downloadPath} "${assetUrl}"`;
        }

        await execAsync(curlCmd);

        // Ensure extract dir exists and is clear
        if (fs.existsSync(extractPath)) {
            fs.rmSync(extractPath, { recursive: true, force: true });
        }
        fs.mkdirSync(extractPath, { recursive: true });

        // Unzip
        await execAsync(`unzip -o ${downloadPath} -d ${extractPath}`);

        // We only care about migrations/ and seed.sql, but we just leave them in /tmp/database_artifact
        return NextResponse.json({ success: true, message: 'Database artifact downloaded and extracted.' });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
