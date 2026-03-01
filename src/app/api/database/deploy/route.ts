import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getSetting } from '@/lib/db';
import axios from 'axios';

const execAsync = promisify(exec);

export async function GET() {
    try {
        const repo = await getSetting('GITHUB_ARTIFACTS_REPO', '');
        const pat = await getSetting('GITHUB_ARTIFACTS_PAT', '');

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

        const pat = await getSetting('GITHUB_ARTIFACTS_PAT', '');

        const downloadPath = path.join('/tmp', 'database_artifact.zip');
        const extractPath = path.join('/tmp', 'database_artifact');

        // Download carefully using Axios, which automatically drops the Authorization header when redirecting to S3
        const headers: Record<string, string> = {
            'Accept': 'application/octet-stream',
            'User-Agent': 'Supabase-Manager'
        };

        if (pat) {
            headers['Authorization'] = `token ${pat}`;
        }

        try {
            const response = await axios({
                method: 'get',
                url: assetUrl,
                responseType: 'stream',
                headers: headers,
                maxRedirects: 10
            });

            const writer = fs.createWriteStream(downloadPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(true));
                writer.on('error', reject);
            });
        } catch (downloadErr: any) {
            console.error('Database artifact download error:', downloadErr.message);
            const status = downloadErr.response?.status || 400;
            return NextResponse.json({ error: `GitHub Asset Download failed (${status}): Check PAT token or Asset URL` }, { status });
        }

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
