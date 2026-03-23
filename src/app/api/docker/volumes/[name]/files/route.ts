import { NextRequest, NextResponse } from 'next/server';
import docker from '@/lib/docker';
import path from 'path';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ name: string }> }
) {
    try {
        const resolvedParams = await params;
        const { searchParams } = new URL(req.url);
        const dirPath = searchParams.get('path') || '/';

        // Validate path to prevent directory traversal
        const safePath = path.normalize(dirPath).replace(/^(\.\.[\/\\])+/, '');
        const targetPath = path.posix.join('/vol', safePath);

        // Ensure alpine image exists before creating the container
        await new Promise((resolve, reject) => {
            docker.pull('alpine:latest', (err: any, stream: any) => {
                if (err) return reject(err);
                docker.modem.followProgress(stream, onFinished, onProgress);
                function onFinished(err: any, output: any) {
                    if (err) return reject(err);
                    resolve(output);
                }
                function onProgress(event: any) { }
            });
        });

        // Decode bind mount safe ID if it was passed
        let decodedName = resolvedParams.name;
        if (decodedName.startsWith('bind-')) {
            const hexPart = decodedName.substring(5);
            decodedName = Buffer.from(hexPart, 'hex').toString('utf-8');
        }

        // We spawn a tiny alpine container to list the files inside the volume
        // This avoids needing root access on the host to read /var/lib/docker/volumes

        const container = await docker.createContainer({
            Image: 'alpine',
            Cmd: ['sh', '-c', `ls -la "${targetPath}"`],
            HostConfig: {
                Binds: [`${decodedName}:/vol:ro`] // Mount read-only
            }
        });

        // Attach BEFORE starting to avoid race conditions
        const stream = await container.attach({ stream: true, stdout: true, stderr: true });

        const output = await new Promise<string>((resolve, reject) => {
            let stdoutData = '';
            const stdoutPassThrough = new (require('stream').PassThrough)();
            stdoutPassThrough.on('data', (chunk: Buffer) => {
                stdoutData += chunk.toString('utf-8');
            });

            docker.modem.demuxStream(stream, stdoutPassThrough, process.stderr);
            stream.on('end', () => resolve(stdoutData));
            stream.on('error', reject);
        });

        await container.start();
        await container.wait();

        await container.remove({ force: true });

        // Parse 'ls -la' output
        const lines = output.trim().split('\n');
        const files = [];

        // Skip the 'total X' line
        const startIdx = lines[0].startsWith('total') ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Example alpine ls -la output:
            // drwxr-xr-x    2 root     root          4096 Feb 25 12:00 .
            // -rw-r--r--    1 node     node           123 Feb 25 12:00 file.txt
            const parts = line.split(/\s+/);
            if (parts.length >= 9) {
                const permissions = parts[0];
                const isDir = permissions.startsWith('d');
                const size = parseInt(parts[4], 10);
                const date = `${parts[5]} ${parts[6]} ${parts[7]}`;
                const name = parts.slice(8).join(' '); // Reconstruct filename with spaces

                if (name !== '.' && name !== '..') {
                    files.push({
                        name,
                        isDir,
                        size,
                        date,
                        permissions,
                        path: path.posix.join(safePath, name)
                    });
                }
            }
        }

        // Sort: Directories first, then alphabetically
        files.sort((a, b) => {
            if (a.isDir === b.isDir) return a.name.localeCompare(b.name);
            return a.isDir ? -1 : 1;
        });

        return NextResponse.json({ files, currentPath: safePath });
    } catch (error: any) {
        console.error('Error fetching volume files:', error);
        return NextResponse.json({ error: error.message || 'Failed to list volume files' }, { status: 500 });
    }
}
