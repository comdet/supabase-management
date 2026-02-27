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

            try {
                // Moving file to NGINX directories requires SUDO. We hope sudoers is configured.
                await execAsync(`sudo mv ${tmpConfigPath} ${sitesAvailablePath}`);

                // Create symbolic link if not exists
                const checkLinkCmd = `if [ ! -L ${sitesEnabledPath} ]; then sudo ln -s ${sitesAvailablePath} ${sitesEnabledPath}; fi`;
                await execAsync(checkLinkCmd);

                // Test configuration
                await execAsync(`sudo nginx -t`);

                // Reload NGINX
                await execAsync(`sudo systemctl reload nginx`);

                return NextResponse.json({ message: 'NGINX configuration generated and reloaded successfully' });

            } catch (nginxError: any) {
                console.error("NGINX Error:", nginxError.message);

                // Rollback or notify failure
                const isSudoIssue = nginxError.message.includes('sudo: a password is required');
                let errMessage = 'Failed to configure NGINX. ' + nginxError.message;

                if (isSudoIssue) {
                    errMessage = 'Permission Denied: Please add "dmsuser ALL=(ALL) NOPASSWD: /usr/bin/mv, /usr/bin/ln, /usr/sbin/nginx, /bin/systemctl" to your /etc/sudoers file.';
                }

                return NextResponse.json({ error: errMessage }, { status: 500 });
            }
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Nginx API error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
