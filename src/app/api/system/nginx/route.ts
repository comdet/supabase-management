import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = util.promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, projectId } = body;

        if (action === 'status') {
            try {
                const { stdout } = await execAsync('systemctl is-active nginx');
                return NextResponse.json({ status: stdout.trim() });
            } catch (e) {
                return NextResponse.json({ status: 'inactive or not installed' });
            }
        }

        if (action === 'generate' && projectId) {
            const project = await dbGet('SELECT * FROM hosting_projects WHERE id = ?', [projectId]);
            if (!project) {
                return NextResponse.json({ error: 'Project not found' }, { status: 404 });
            }

            const { project_name, domain_name, deploy_path } = project;
            const absolutePath = path.isAbsolute(deploy_path) ? deploy_path : path.join(process.cwd(), '..', deploy_path);

            // NGINX Template for a basic static or SPA site
            const nginxConfig = `server {
    listen 80;
    server_name ${domain_name};

    root ${absolutePath};
    index index.html index.htm;

    access_log /var/log/nginx/${project_name}_access.log;
    error_log /var/log/nginx/${project_name}_error.log;

    location / {
        try_files $uri $uri/ =404;
    }
}
`;
            // Write config to temporary location first because NextJS doesn't have sudo
            const tmpConfigPath = path.join('/tmp', `${project_name}.conf`);
            fs.writeFileSync(tmpConfigPath, nginxConfig);

            const sitesAvailablePath = `/etc/nginx/sites-available/${project_name}.conf`;
            const sitesEnabledPath = `/etc/nginx/sites-enabled/${project_name}.conf`;

            // Return the manual instructions for the frontend instead of running sudo commands directly
            return NextResponse.json({
                message: 'NGINX configuration generated to /tmp.',
                tmpPath: tmpConfigPath,
                domain: domain_name,
                commands: [
                    `sudo mv ${tmpConfigPath} ${sitesAvailablePath}`,
                    `sudo ln -s ${sitesAvailablePath} ${sitesEnabledPath}`,
                    `sudo nginx -t`,
                    `sudo systemctl reload nginx`
                ]
            });

        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Nginx API error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
