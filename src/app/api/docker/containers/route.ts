import { NextResponse } from 'next/server';
import docker from '@/lib/docker';

export async function GET() {
    try {
        const containers = await docker.listContainers({ all: true });

        // Format the response slightly to make it easier for frontend
        const formatted = containers.map(c => ({
            id: c.Id,
            name: c.Names[0]?.replace(/^\//, ''),
            image: c.Image,
            state: c.State,
            status: c.Status,
            created: c.Created,
            ports: c.Ports,
        }));

        return NextResponse.json({ containers: formatted });
    } catch (error: any) {
        console.error('Error fetching containers:', error);
        return NextResponse.json({ error: error.message || 'Failed to list containers' }, { status: 500 });
    }
}
