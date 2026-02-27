import { NextRequest, NextResponse } from 'next/server';
import docker from '@/lib/docker';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> } // In Next 15, route params are Promises
) {
    try {
        const resolvedParams = await params;
        const body = await req.json();
        const action = body.action; // 'start', 'stop', 'restart'

        if (!action || !['start', 'stop', 'restart'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const container = docker.getContainer(resolvedParams.id);

        if (action === 'start') {
            await container.start();
        } else if (action === 'stop') {
            await container.stop();
        } else if (action === 'restart') {
            await container.restart();
        }

        return NextResponse.json({ message: `Container ${action}ed successfully` });
    } catch (error: any) {
        console.error(`Error performing action on container:`, error);
        return NextResponse.json({ error: error.message || 'Failed to perform action' }, { status: 500 });
    }
}
