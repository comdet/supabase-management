import { NextResponse } from 'next/server';
import docker from '@/lib/docker';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = util.promisify(exec);

// Path to store backups on the host machine
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export async function POST(req: Request) {
    try {
        const { type, containerName, volumeName } = await req.json();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        if (type === 'database') {
            if (!containerName) {
                return NextResponse.json({ error: 'Database container name required' }, { status: 400 });
            }

            // Supabase default user is postgres
            const backupFilename = `db-backup-${timestamp}.sql`;
            const backupPath = path.join(BACKUP_DIR, backupFilename);

            // Execute pg_dump inside the container and pipe to a local file
            // Note: This requires the Next.js process to have permission to write to BACKUP_DIR
            // and docker exec permissions (which we get via the socket)

            // For a more robust approach in node, we could use dockerode's exec, 
            // but child_process is simpler for pipelining if docker CLI is available.
            // Since we want to use dockerode to avoid depending on CLI availability:

            const container = docker.getContainer(containerName);
            const execInstance = await container.exec({
                AttachStdin: false,
                AttachStdout: true,
                AttachStderr: true,
                Cmd: ['pg_dump', '-U', 'postgres', '-d', 'postgres', '--clean', '--if-exists']
            });

            const streamObj = await execInstance.start({ Detach: false, Tty: false });

            const stream = streamObj as NodeJS.ReadableStream;
            const writeStream = fs.createWriteStream(backupPath);

            await new Promise((resolve, reject) => {
                docker.modem.demuxStream(stream, writeStream, process.stderr);
                stream.on('end', resolve);
                stream.on('error', reject);
            });

            return NextResponse.json({
                message: 'Database backup created',
                filename: backupFilename,
                path: backupPath
            });

        } else if (type === 'volume') {
            if (!volumeName) {
                return NextResponse.json({ error: 'Volume name required' }, { status: 400 });
            }

            const backupFilename = `volume-${volumeName}-${timestamp}.tar.gz`;
            const backupPathHost = path.join(BACKUP_DIR, backupFilename);

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

            // Use an alpine container to tar the volume and stream it
            const container = await docker.createContainer({
                Image: 'alpine',
                Cmd: ['tar', '-czf', '-', '-C', '/vol', '.'],
                HostConfig: {
                    Binds: [`${volumeName}:/vol:ro`]
                }
            });

            await container.start();
            const logStream = await container.logs({ stdout: true, follow: true });

            const writeStream = fs.createWriteStream(backupPathHost);

            // Strip 8-byte header from stdout stream
            await new Promise((resolve, reject) => {
                if (!logStream || typeof (logStream as any).on !== 'function') return resolve(null);

                const stream = logStream as NodeJS.ReadableStream;
                stream.on('data', (chunk: Buffer) => {
                    let offset = 0;
                    while (offset < chunk.length) {
                        if (chunk.length - offset < 8) break;
                        const length = chunk.readUInt32BE(offset + 4);
                        offset += 8;
                        if (offset + length <= chunk.length) {
                            writeStream.write(chunk.subarray(offset, offset + length));
                            offset += length;
                        } else {
                            break;
                        }
                    }
                });
                stream.on('end', resolve);
                stream.on('error', reject);
            });

            await container.remove({ force: true });
            writeStream.end();

            return NextResponse.json({
                message: 'Volume backup created',
                filename: backupFilename,
                path: backupPathHost
            });
        }

        return NextResponse.json({ error: 'Invalid backup type' }, { status: 400 });
    } catch (error: any) {
        console.error('Backup error:', error);
        return NextResponse.json({ error: error.message || 'Backup failed' }, { status: 500 });
    }
}

export async function GET() {
    // List available backups
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            return NextResponse.json({ backups: [] });
        }

        const files = fs.readdirSync(BACKUP_DIR);
        const backups = files.map(filename => {
            const stats = fs.statSync(path.join(BACKUP_DIR, filename));
            return {
                filename,
                size: stats.size,
                date: stats.mtime
            };
        }).sort((a, b) => b.date.getTime() - a.date.getTime());

        return NextResponse.json({ backups });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
    }
}
