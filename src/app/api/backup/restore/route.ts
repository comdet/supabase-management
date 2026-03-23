import { NextResponse } from 'next/server';
import docker from '@/lib/docker';
import path from 'path';
import fs from 'fs';
import { getSetting } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const BACKUP_DIR = await getSetting('BACKUP_DIR', path.join(process.cwd(), 'backups'));

        const { type, containerName, volumeName, filename } = await req.json();

        if (!filename) {
            return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
        }

        const safeFilename = path.basename(filename);
        const backupPath = path.join(BACKUP_DIR, safeFilename);

        if (!fs.existsSync(backupPath)) {
            return NextResponse.json({ error: 'Backup file not found' }, { status: 404 });
        }

        if (type === 'database') {
            if (!containerName) {
                return NextResponse.json({ error: 'Database container name required' }, { status: 400 });
            }

            const container = docker.getContainer(containerName);

            // Execute psql inside the container. We pipe the sql file into stdin
            const execInstance = await container.exec({
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Cmd: ['psql', '-U', 'postgres', '-d', 'postgres']
            });

            const streamObj = await execInstance.start({ Detach: false, Tty: false, hijack: true, stdin: true });

            // Types package definition for dockerode might type streamObj as just ReadableStream
            // but when AttachStdin is true, it's actually a Duplex stream.
            const stream = streamObj as any;
            const fileStream = fs.createReadStream(backupPath);

            await new Promise((resolve, reject) => {
                // Pipe the file data to the exec stdin stream
                fileStream.pipe(stream);

                fileStream.on('end', () => {
                    // Close stdin to tell psql we are done sending data
                    stream.end();
                });

                // Read output so the stream drains properly, preventing lockups
                docker.modem.demuxStream(stream, process.stdout, process.stderr);

                stream.on('end', resolve);
                stream.on('error', reject);
            });

            return NextResponse.json({ message: 'Database restored successfully' });

        } else if (type === 'volume') {
            if (!volumeName) {
                return NextResponse.json({ error: 'Volume name required' }, { status: 400 });
            }

            // Ensure alpine image exists
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

            let decodedVolumeName = volumeName;
            if (decodedVolumeName.startsWith('bind-')) {
                const hexPart = decodedVolumeName.substring(5);
                decodedVolumeName = Buffer.from(hexPart, 'hex').toString('utf-8');
            }

            // Read the tar from stdin and extract it to /vol
            const container = await docker.createContainer({
                Image: 'alpine:latest',
                Cmd: ['tar', '-xzf', '-', '-C', '/vol'],
                HostConfig: {
                    Binds: [`${decodedVolumeName}:/vol`] // Write access needed format: volumeName:/path/in/container
                },
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                OpenStdin: true,
                StdinOnce: true
            });

            // Attach BEFORE starting to avoid race conditions
            const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true }) as any;

            const fileStream = fs.createReadStream(backupPath);

            // Pipe backup data to container stdin
            fileStream.pipe(stream);
            fileStream.on('end', () => {
                stream.end();
            });

            // Drain stdout/stderr to prevent lockups
            docker.modem.demuxStream(stream, process.stdout, process.stderr);

            await container.start();

            // Wait for the container to finish extraction
            const waitResult = await container.wait();
            await container.remove({ force: true });

            if (waitResult.StatusCode !== 0) {
                return NextResponse.json({ error: `Volume restore failed with exit code ${waitResult.StatusCode}` }, { status: 500 });
            }

            return NextResponse.json({ message: 'Volume restored successfully' });
        }

        return NextResponse.json({ error: 'Invalid restore type' }, { status: 400 });
    } catch (error: any) {
        console.error('Restore error:', error);
        return NextResponse.json({ error: error.message || 'Restore failed' }, { status: 500 });
    }
}
