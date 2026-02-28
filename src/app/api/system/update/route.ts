import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import https from 'https';
import * as tar from 'tar';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

// Fetch current version from package.json
const getLocalVersion = async () => {
    try {
        const pkgPath = path.join(process.cwd(), 'package.json');
        const pkgData = await fs.readFile(pkgPath, 'utf8');
        return JSON.parse(pkgData).version;
    } catch (e) {
        return '0.1.0';
    }
};

const GITHUB_API_URL = 'https://api.github.com/repos/comdet/supabase-management/releases/latest';

export async function GET(req: Request) {
    try {
        // Fetch latest release from GitHub
        const response = await fetch(GITHUB_API_URL, {
            headers: {
                'User-Agent': 'Supabase-Manager-Auto-Updater',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API responded with ${response.status}`);
        }

        const data = await response.json();
        const latestVersion = data.tag_name?.replace('v', '') || 'unknown';
        const currentVersion = await getLocalVersion();

        let downloadUrl = null;
        if (data.assets && data.assets.length > 0) {
            const asset = data.assets.find((a: any) => a.name === 'supabase-manager-release.tar.gz');
            if (asset) downloadUrl = asset.browser_download_url;
        }

        return NextResponse.json({
            currentVersion,
            latestVersion,
            hasUpdate: currentVersion !== latestVersion && latestVersion !== 'unknown',
            releaseNotes: data.body,
            publishedAt: data.published_at,
            downloadUrl
        });

    } catch (error: any) {
        console.error('Check Update Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to check updates' }, { status: 500 });
    }
}

// -------------------------------------------------------------
// POST: Execute the Download, Extract, and Restart Process
// -------------------------------------------------------------
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { downloadUrl } = body;

        if (!downloadUrl) {
            return NextResponse.json({ error: 'downloadUrl is required' }, { status: 400 });
        }

        const TAR_PATH = path.join('/tmp', 'supabase-manager-update.tar.gz');
        const PROJECT_DIR = process.cwd();

        // 1. Download the tar.gz file
        await new Promise((resolve, reject) => {
            const file = createWriteStream(TAR_PATH);
            https.get(downloadUrl, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    const redirectUrl = response.headers.location;
                    if (!redirectUrl) return reject(new Error('Redirect URL missing'));

                    https.get(redirectUrl, (resRedirect) => {
                        resRedirect.pipe(file);
                        file.on('finish', () => { file.close(); resolve(true); });
                    }).on('error', (err) => { fs.unlink(TAR_PATH).catch(() => { }); reject(err); });
                } else if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                } else {
                    response.pipe(file);
                    file.on('finish', () => { file.close(); resolve(true); });
                }
            }).on('error', (err) => {
                fs.unlink(TAR_PATH).catch(() => { });
                reject(err);
            });
        });

        // 1.5. Remove previous build directory completely to prevent old hashed chunks from serving cached JS
        const nextDir = path.join(PROJECT_DIR, '.next');
        try {
            await fs.rm(nextDir, { recursive: true, force: true });
        } catch (rmError) {
            console.warn('Could not remove .next directory, bypassing...', rmError);
        }

        // 2. Extract the tar.gz directly over the project directory
        // NOTE: The .tar.gz bundle from GitHub Actions ALREADY contains a fully compiled .next folder!
        // So NO NEED to run `npm run build` on this server again.
        await tar.x({
            file: TAR_PATH,
            C: PROJECT_DIR,
            keep: false
        });

        // 3. Install ALL dependencies (avoiding --omit=dev so the user's manual node_modules doesn't look completely deleted/broken)
        try {
            await execAsync('npm install', { cwd: PROJECT_DIR });
        } catch (npmErr) {
            console.warn('npm install warning (non-fatal):', npmErr);
        }

        // Clean up tarball
        await fs.unlink(TAR_PATH).catch(() => { });

        // 4. Trigger PM2 Restart immediately (Delayed slightly so API responds first)
        setTimeout(() => {
            console.log('Update Complete. Initiating PM2 App Restart...');
            exec('npx pm2 reload supabase-manager || npx pm2 reload all', (err) => {
                if (err) console.error('Failed to restart PM2:', err);
            });
        }, 3000);

        return NextResponse.json({
            success: true,
            message: 'Update downloaded and extracted successfully. Server is restarting...'
        });

    } catch (error: any) {
        console.error('Execute Update Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to apply update' }, { status: 500 });
    }
}
