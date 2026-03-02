import { NextResponse } from 'next/server';
import docker from '@/lib/docker';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';

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
                try {
                    // Try without sudo first (in case running as root)
                    const { stdout } = await execAsync('ufw status');
                    firewallStatus = stdout.trim();
                } catch (err: unknown) {
                    try {
                        // Try reading the configuration file directly as a fallback
                        if (fs.existsSync('/etc/ufw/ufw.conf')) {
                            const conf = fs.readFileSync('/etc/ufw/ufw.conf', 'utf8');
                            const isEnabled = conf.includes('ENABLED=yes');

                            let rulesText = '';
                            try {
                                if (fs.existsSync('/etc/ufw/user.rules')) {
                                    const rulesFile = fs.readFileSync('/etc/ufw/user.rules', 'utf8');
                                    const matches = [...rulesFile.matchAll(/### tuple ### allow (tcp|udp) (\d+) 0\.0\.0\.0\/0 any 0\.0\.0\.0\/0 in/g)];
                                    if (matches.length > 0) {
                                        rulesText = '\n\nActive Rules (IPv4):\n' + matches.map(m => `ALLOW ${m[2]}/${m[1]} (Anywhere)`).join('\n');
                                    } else {
                                        // Try regex for alternative formats
                                        const altMatches = [...rulesFile.matchAll(/-A ufw-user-input -p (tcp|udp) --dport (\d+) -j ACCEPT/g)];
                                        if (altMatches.length > 0) {
                                            rulesText = '\n\nOpen Ports (IPv4):\n' + altMatches.map(m => `ALLOW ${m[2]}/${m[1]}`).join('\n');
                                        } else {
                                            rulesText = '\n\nNo explicitly open ports found or unable to parse rules.';
                                        }
                                    }
                                }
                            } catch (ruleErr) {
                                rulesText = '\n\n[Permission Denied: Cannot read /etc/ufw/user.rules to show exact ports]';
                            }

                            firewallStatus = `Status: ${isEnabled ? 'active' : 'inactive'} (Basic check)${rulesText}\n\n⚠️ Full rules hidden: Node process lacks sudo privileges.\nTo view full rules securely, run this in terminal:\n  echo "$(whoami) ALL=(ALL) NOPASSWD: /usr/sbin/ufw status" | sudo tee /etc/sudoers.d/nodejs-ufw`;
                        } else {
                            firewallStatus = `Error: You need to be root to run this script. (Permission Denied)\n\nTo view full firewall rules, you must either:\n1. Run the Node app as root\n2. Grant NOPASSWD sudo access for 'ufw status'`;
                        }
                    } catch (fallbackErr: unknown) {
                        firewallStatus = `Firewall status unavailable: Permission Denied\n(Requires sudo/admin privileges)`;
                    }
                }
            }
        } catch (globalErr: unknown) {
            // Unlikely to hit this since inner blocks have their own try-catch now,
            // but just in case of unforeseen errors in the OS branching itself.
            const error = globalErr as Error;
            firewallStatus = `Firewall status check failed: ${error.message}`;
        }

        return NextResponse.json({
            host: hostPorts,
            docker: dockerPorts,
            firewall: firewallStatus
        });

    } catch (error: unknown) {
        console.error('Port scan error:', error);
        const err = error as Error;
        return NextResponse.json({ error: err.message || 'Failed to list ports' }, { status: 500 });
    }
}
