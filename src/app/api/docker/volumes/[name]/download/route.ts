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

        // We stream the file via 'cat' from an alpine container
        const container = await docker.createContainer({
            Image: 'alpine',
            Cmd: ['cat', targetPath],
            HostConfig: {
                Binds: [`${resolvedParams.name}:/vol:ro`]
            }
        });

        await container.start();

        const logStream = await container.logs({
            stdout: true,
            stderr: false,
            follow: true
        });

        // We need to strip the 8-byte multiplexing header from the steam
        // Or we can just use child_process to docker exec -i / docker run ...
        // Since 'cat' might return binary data, manual stripping is safer:

        let fileBuffer = Buffer.alloc(0);

        if (logStream && typeof (logStream as any).on === 'function') {
            await new Promise((resolve, reject) => {
                const stream = logStream as NodeJS.ReadableStream;
                stream.on('data', (chunk: Buffer) => {
                    let offset = 0;
                    while (offset < chunk.length) {
                        if (chunk.length - offset < 8) break;
                        const length = chunk.readUInt32BE(offset + 4);
                        offset += 8;
                        if (offset + length <= chunk.length) {
                            fileBuffer = Buffer.concat([fileBuffer, chunk.subarray(offset, offset + length)]);
                            offset += length;
                        } else {
                            break;
                        }
                    }
                });
                stream.on('end', resolve);
                stream.on('error', reject);
            });
        }

        await container.remove({ force: true });

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
