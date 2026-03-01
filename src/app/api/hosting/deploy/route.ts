import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';

const execAsync = util.promisify(exec);

// API เส้นนี้แยกออกมาเพื่อทำการ Deploy ล้วนดึงโค้ดลงมาใส่โฟลเดอร์
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, tarball_url, asset_url, version } = body;

        if (!id || (!tarball_url && !asset_url) || !version) {
            return NextResponse.json({ error: 'Project ID, asset_url (or tarball_url), and version are required' }, { status: 400 });
        }

        const project = await dbGet('SELECT * FROM hosting_projects WHERE id = ?', [id]);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { project_name, deploy_path, pat_token } = project;

        // Ensure deploy path is absolute
        const absoluteDeployPath = path.isAbsolute(deploy_path)
            ? deploy_path
            : path.join(process.cwd(), '..', deploy_path); // Default relative to outside supabase_manager

        // Security check, never deploy to / or /etc or /var
        if (['/', '/etc', '/var'].includes(absoluteDeployPath)) {
            return NextResponse.json({ error: 'Invalid or restricted deploy path' }, { status: 403 });
        }

        // 1. Prepare temp directory
        const maxTimeStr = new Date().getTime().toString();
        const tmpFile = path.join('/tmp', `deploy-${project_name}-${maxTimeStr}.tar.gz`);
        const extractDir = path.join('/tmp', `extract-${project_name}-${maxTimeStr}`);

        // 2. Download from GitHub
        const headers: any = {
            'Accept': asset_url ? 'application/octet-stream' : 'application/vnd.github.v3.raw',
            'User-Agent': 'Supabase-Manager-App'
        };

        if (pat_token) {
            // Note: API doc says use `Authorization: Bearer <token>` for Assets
            headers['Authorization'] = `token ${pat_token}`;
        }

        if (!fs.existsSync(extractDir)) {
            fs.mkdirSync(extractDir, { recursive: true });
        }

        try {
            const downloadUrl = asset_url || tarball_url;
            console.log(`Downloading target from: ${downloadUrl}`);
            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream',
                headers: headers,
                maxRedirects: 10 // GitHub API redirects to S3 temporary URLs for assets
            });

            const writer = fs.createWriteStream(tmpFile);
            response.data.pipe(writer);

            // Wait for download to finish
            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(true));
                writer.on('error', reject);
            });

        } catch (downloadError: any) {
            console.error("Tarball download error:", downloadError.message);
            return NextResponse.json({ error: 'Failed to download release file. Check your PAT token if repo is private.' }, { status: 400 });
        }

        // 3. Extract logic
        // GitHub release tarballs usually have an annoying top root folder `owner-repo-commitID/`
        // We use `--strip-components=1` to drop that upper layer and lay it flat inside our extractDir
        await execAsync(`tar -xzf ${tmpFile} -C ${extractDir} --strip-components=1`);

        // 4. Ensure destination exists
        if (!fs.existsSync(absoluteDeployPath)) {
            fs.mkdirSync(absoluteDeployPath, { recursive: true });
        }

        // 5. Move files (we use cp instead of mv to handle overlaps safely)
        await execAsync(`cp -R ${extractDir}/* ${absoluteDeployPath}/`);

        // 6. Clean up temp files
        await execAsync(`rm -rf ${tmpFile} ${extractDir}`);

        // 7. Update database record
        await dbRun('UPDATE hosting_projects SET current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [version, id]);

        return NextResponse.json({
            message: 'Deployed successfully',
            version,
            path: absoluteDeployPath
        });

    } catch (error: any) {
        console.error('Deploy error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
