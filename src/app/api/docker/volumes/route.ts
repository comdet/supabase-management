import { NextResponse } from 'next/server';
import docker from '@/lib/docker';

export async function GET() {
    try {
        const data = await docker.listVolumes();

        // Sort by name
        const volumes = data.Volumes.sort((a, b) => a.Name.localeCompare(b.Name));

        return NextResponse.json({ volumes });
    } catch (error: any) {
        console.error('Error fetching volumes:', error);
        return NextResponse.json({ error: error.message || 'Failed to list volumes' }, { status: 500 });
    }
}
