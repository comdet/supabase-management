import { NextResponse } from 'next/server';
import docker from '@/lib/docker';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export async function GET() {
    try {
        const isMac = os.platform() === 'darwin';
        let hostPorts: { port: string, proto: string, localAddress: string }[] = [];

        try {
            if (isMac) {
                // macOS: `netstat -an | grep LISTEN`
                const { stdout } = await execAsync('netstat -an | grep -i listen');
                const lines = stdout.split('\n').filter(l => l.includes('LISTEN'));
                hostPorts = lines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    // Usually: tcp4 0 0 *.3000 *.* LISTEN
                    const localAddr = parts[3];
                    if (!localAddr) return null;
                    const match = localAddr.match(/\.(\d+)$/);
                    const port = match ? match[1] : '';
                    return { port, proto: parts[0], localAddress: localAddr };
                }).filter((p): p is any => Boolean(p?.port));
            } else {
                // Linux (Ubuntu): `ss -tuln`
                const { stdout } = await execAsync('ss -tuln');
                const lines = stdout.split('\n').slice(1).filter(l => l.trim().length > 0);
                hostPorts = lines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    // Usually: tcp LISTEN 0 4096 0.0.0.0:8000 0.0.0.0:*
                    if (parts.length < 5) return null;
                    const proto = parts[0];
                    const localAddr = parts[4];
                    const match = localAddr.match(/:(\d+)$/);
                    const port = match ? match[1] : '';
                    return { port, proto, localAddress: localAddr };
                }).filter((p): p is any => Boolean(p?.port));
            }
        } catch (e) {
            console.error('Failed to get host ports:', e);
        }

        // Get docker ports
        const containers = await docker.listContainers({ all: true });
        const dockerPorts = containers.flatMap(c => {
            return (c.Ports || []).map(p => ({
                container: c.Names[0]?.replace(/^\//, ''),
                privatePort: p.PrivatePort,
                publicPort: p.PublicPort,
                type: p.Type,
                ip: p.IP
            }));
        }).filter(p => p.publicPort);

        // Get Firewall Status
        let firewallStatus = 'Unknown firewall status';
        try {
            if (isMac) {
                const { stdout } = await execAsync('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate');
                firewallStatus = stdout.trim();
            } else if (os.platform() === 'win32') {
                const { stdout } = await execAsync('netsh advfirewall show allprofiles state');
                firewallStatus = stdout.trim();
            } else {
                // Assume Linux / Ubuntu
                const { stdout } = await execAsync('ufw status');
                firewallStatus = stdout.trim();
            }
        } catch (e: any) {
            firewallStatus = `Firewall status unavailable: ${e.message}\n(May require sudo/admin privileges)`;
        }

        return NextResponse.json({
            host: hostPorts,
            docker: dockerPorts,
            firewall: firewallStatus
        });

    } catch (error: any) {
        console.error('Port scan error:', error);
        return NextResponse.json({ error: error.message || 'Failed to list ports' }, { status: 500 });
    }
}
