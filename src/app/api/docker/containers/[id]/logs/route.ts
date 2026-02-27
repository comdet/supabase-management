import { NextRequest, NextResponse } from 'next/server';
import docker from '@/lib/docker';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const { searchParams } = new URL(req.url);
        const tailStr = searchParams.get('tail') || '100';
        const tail = parseInt(tailStr, 10);

        const container = docker.getContainer(resolvedParams.id);

        // dockerode returns a stream
        const logStream = await container.logs({
            stdout: true,
            stderr: true,
            timestamps: true,
            tail: tail
        });

        const logs = await new Promise<string>((resolve, reject) => {
            let logData = '';
            if (logStream && typeof (logStream as any).on === 'function') {
                const stream = logStream as any;
                stream.on('data', (chunk: Buffer) => {
                    // Docker multiplexing header is 8 bytes
                    // We can just strip non-printable characters or parse properly
                    // A simple parse to avoid garbage characters:
                    let offset = 0;
                    while (offset < chunk.length) {
                        if (chunk.length - offset < 8) {
                            // partial header, fallback to just strings
                            logData += chunk.subarray(offset).toString('utf-8');
                            break;
                        }
                        const length = chunk.readUInt32BE(offset + 4);
                        offset += 8;
                        if (offset + length <= chunk.length) {
                            logData += chunk.subarray(offset, offset + length).toString('utf-8');
                            offset += length;
                        } else {
                            logData += chunk.subarray(offset).toString('utf-8');
                            break;
                        }
                    }
                });
                stream.on('end', () => resolve(logData));
                stream.on('error', (err: any) => reject(err));
            } else if (Buffer.isBuffer(logStream)) {
                resolve((logStream as Buffer).toString('utf-8'));
            } else {
                // Fallback
                resolve(String(logStream));
            }
        });

        return NextResponse.json({ logs });
    } catch (error: any) {
        console.error(`Error fetching logs:`, error);
        return NextResponse.json({ error: error.message || 'Failed to fetch logs' }, { status: 500 });
    }
}
