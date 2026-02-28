import { NextResponse } from 'next/server';
import docker from '@/lib/docker';

export async function GET() {
    try {
        const data = await docker.listVolumes();

        const namedVolumes = data.Volumes.map((v: any) => ({
            Id: v.Name,
            Name: v.Name,
            Driver: v.Driver,
            Mountpoint: v.Mountpoint,
            CreatedAt: v.CreatedAt,
            Type: 'volume'
        }));

        const containers = await docker.listContainers({ all: true });
        const bindMountsMap = new Map();

        for (const container of containers) {
            if (container.Mounts) {
                for (const mount of container.Mounts) {
                    if (mount.Type === 'bind') {
                        const source = mount.Source;
                        if (!bindMountsMap.has(source)) {
                            const safeId = 'bind-' + Buffer.from(source).toString('hex');
                            bindMountsMap.set(source, {
                                Id: safeId,
                                Name: source,
                                Driver: 'local (bind)',
                                Mountpoint: source,
                                Type: 'bind'
                            });
                        }
                    }
                }
            }
        }

        const bindMounts = Array.from(bindMountsMap.values());

        const volumes = [...namedVolumes, ...bindMounts].sort((a, b) => a.Name.localeCompare(b.Name));

        return NextResponse.json({ volumes });
    } catch (error: any) {
        console.error('Error fetching volumes:', error);
        return NextResponse.json({ error: error.message || 'Failed to list volumes' }, { status: 500 });
    }
}
