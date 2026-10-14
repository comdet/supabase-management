import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import docker from '@/lib/docker';
import { containerLabel, findEdgeRuntimeContainers } from '@/lib/edge-runtime';

const execAsync = util.promisify(exec);

export async function GET() {
    try {
        const repo = await getSetting('GITHUB_ARTIFACTS_REPO', '');
        const pat = await getSetting('GITHUB_ARTIFACTS_PAT', '');

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

        const pat = await getSetting('GITHUB_ARTIFACTS_PAT', '');
        const projectPath = await getSetting('SUPABASE_PROJECT_PATH', '');

        if (!assetUrl) return NextResponse.json({ error: 'Asset API URL is required' }, { status: 400 });
        if (!projectPath) return NextResponse.json({ error: 'Supabase Project Path not configured. Go to Settings to configure.' }, { status: 400 });

        const tmpFilePath = path.join(os.tmpdir(), `functions_${Date.now()}.zip`);

        // 1. Download asset using Axios (Axios safely drops Authorization header upon S3 redirect, preventing 400/401 errors)
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

            const writer = fs.createWriteStream(tmpFilePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(true));
                writer.on('error', reject);
            });
        } catch (downloadErr: any) {
            console.error('Functions asset download error:', downloadErr.message);
            const status = downloadErr.response?.status || 400;
            return NextResponse.json({ error: `GitHub Asset Download failed (${status}): Check PAT token or Asset URL` }, { status });
        }

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
        } finally {
            // 3. Cleanup — the zip is not needed once extracted (or failed)
            try {
                fs.unlinkSync(tmpFilePath);
            } catch (e) {
                console.error('Failed to cleanup temp file', e);
            }
        }

        // 4. Restart Edge Runtime — until it restarts it keeps serving the old functions,
        // so a failed restart is reported as an error, not as a successful deploy
        const restarted: string[] = [];
        try {
            const containers = await docker.listContainers({ all: true });
            const targets = findEdgeRuntimeContainers(containers, functionsVolPath);
            if (!targets.length) {
                throw new Error(`no edge-runtime container found (looked for the container that mounts ${functionsVolPath}, then for image supabase/edge-runtime)`);
            }

            for (const target of targets) {
                await docker.getContainer(target.Id).restart();
                restarted.push(containerLabel(target));
            }
            console.log('Restarted edge runtime via Docker API:', restarted.join(', '));
        } catch (dockerErr: unknown) {
            console.error('Docker restart failed:', dockerErr);
            const done = restarted.length ? ` (restarted: ${restarted.join(', ')})` : '';
            return NextResponse.json({ error: `Functions were extracted to ${functionsVolPath}, but the edge runtime was NOT restarted${done}, so the previous functions are still running. Restart it by hand (docker restart <edge-runtime container>). Details: ${(dockerErr as Error).message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: `Edge functions deployed and runtime restarted (${restarted.join(', ')})` });

    } catch (error: any) {
        console.error('Functions deploy error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
