import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = util.promisify(exec);

export async function GET() {
    try {
        const repo = await getSetting('SUPABASE_FUNCTIONS_REPO', '');
        const pat = await getSetting('SUPABASE_FUNCTIONS_PAT', '');

        if (!repo) {
            return NextResponse.json({ error: 'GitHub Repository not configured in settings. Go to Settings to configure.' }, { status: 400 });
        }

        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Supabase-Manager'
        };

        if (pat) {
            headers['Authorization'] = `token ${pat}`;
        }

        const response = await fetch(`https://api.github.com/repos/${repo}/releases`, { headers });
        if (!response.ok) {
            return NextResponse.json({ error: `GitHub API returned ${response.status}: ${response.statusText}` }, { status: response.status });
        }

        const data = await response.json();
        const releases = data.map((r: any) => ({
            id: r.id,
            tag_name: r.tag_name,
            name: r.name,
            published_at: r.published_at,
            assets: r.assets.map((a: any) => ({
                id: a.id,
                name: a.name,
                url: a.url, // URL for API download with Accept: application/octet-stream
                browser_download_url: a.browser_download_url
            }))
        }));

        return NextResponse.json({ releases, repo });
    } catch (error: any) {
        console.error('Functions releases error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { assetUrl } = body;

        const pat = await getSetting('SUPABASE_FUNCTIONS_PAT', '');
        const projectPath = await getSetting('SUPABASE_PROJECT_PATH', '');

        if (!assetUrl) return NextResponse.json({ error: 'Asset API URL is required' }, { status: 400 });
        if (!projectPath) return NextResponse.json({ error: 'Supabase Project Path not configured. Go to Settings to configure.' }, { status: 400 });

        const headers: Record<string, string> = {
            'Accept': 'application/octet-stream',
            'User-Agent': 'Supabase-Manager'
        };

        if (pat) {
            headers['Authorization'] = `token ${pat}`;
        }

        // 1. Download asset
        const response = await fetch(assetUrl, { headers });
        if (!response.ok) {
            return NextResponse.json({ error: `GitHub Asset Download returned ${response.status}: ${response.statusText}` }, { status: response.status });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const tmpFilePath = path.join(os.tmpdir(), `functions_${Date.now()}.zip`);
        fs.writeFileSync(tmpFilePath, buffer);

        // 2. Extract asset to Supabase volumes/functions
        const functionsVolPath = path.join(projectPath, 'volumes', 'functions');

        if (!fs.existsSync(functionsVolPath)) {
            fs.mkdirSync(functionsVolPath, { recursive: true });
        }

        const isWindows = os.platform() === 'win32';
        try {
            if (isWindows) {
                // Windows 10+ has tar built-in which can extract zip files
                await execAsync(`tar -xf "${tmpFilePath}" -C "${functionsVolPath}"`);
            } else {
                // Assuming Ubuntu/Debian has unzip
                await execAsync(`unzip -o "${tmpFilePath}" -d "${functionsVolPath}"`);
            }
        } catch (extractErr: any) {
            return NextResponse.json({ error: 'Failed to extract artifacts. Ensure "unzip" (Linux) or "tar" (Windows) is installed. Details: ' + extractErr.message }, { status: 500 });
        }

        // 3. Restart Edge Runtime
        try {
            await execAsync(`docker compose restart edge-runtime`, { cwd: projectPath });
        } catch (dockerErr: any) {
            console.error('Docker restart failed:', dockerErr);
            return NextResponse.json({ success: true, message: 'Functions extracted successfully, but failed to restart edge-runtime container automatically. You may need to manually restart it.' });
        }

        // 4. Cleanup
        try {
            fs.unlinkSync(tmpFilePath);
        } catch (e) {
            console.error('Failed to cleanup temp file', e);
        }

        return NextResponse.json({ success: true, message: 'Edge functions deployed and runtime restarted successfully' });

    } catch (error: any) {
        console.error('Functions deploy error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
