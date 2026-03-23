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
        const filePath = searchParams.get('path');

        if (!filePath) {
            return new NextResponse('File path is required', { status: 400 });
        }

        const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
        const targetPath = path.posix.join('/vol', safePath);

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

        // Decode bind mount safe ID if it was passed
        let decodedName = resolvedParams.name;
        if (decodedName.startsWith('bind-')) {
            const hexPart = decodedName.substring(5);
            decodedName = Buffer.from(hexPart, 'hex').toString('utf-8');
        }

        // We stream the file via 'cat' from an alpine container
        const container = await docker.createContainer({
            Image: 'alpine',
            Cmd: ['cat', targetPath],
            HostConfig: {
                Binds: [`${decodedName}:/vol:ro`]
            }
        });

        // Attach BEFORE starting to avoid race conditions with binary streams
        const stream = await container.attach({ stream: true, stdout: true, stderr: true });

        const chunks: Buffer[] = [];
        const stdoutPassThrough = new (require('stream').PassThrough)();
        stdoutPassThrough.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });

        docker.modem.demuxStream(stream, stdoutPassThrough, process.stderr);

        const streamPromise = new Promise<void>((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
        });

        await container.start();
        await streamPromise;
        await container.wait();
        await container.remove({ force: true });

        const fileBuffer = Buffer.concat(chunks);

        const filename = path.basename(safePath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'application/octet-stream'
            }
        });

    } catch (error: any) {
        console.error('Error downloading file:', error);
        return new NextResponse('Failed to download file', { status: 500 });
    }
}
