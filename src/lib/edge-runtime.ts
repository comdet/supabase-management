import fs from 'fs';
import path from 'path';
import type { ContainerInfo } from 'dockerode';

const realPath = (p: string): string => {
    try {
        return fs.realpathSync(p);
    } catch {
        return path.resolve(p);
    }
};

/**
 * Finds the edge-runtime container(s) to restart after new functions are
 * extracted to `functionsVolPath`.
 *
 * The container name differs per setup (self-hosted docker-compose names it
 * `supabase-edge-functions`, the Supabase CLI `supabase_edge_runtime_<id>`),
 * so it is matched by what it mounts first, then by its image — never by name.
 */
export function findEdgeRuntimeContainers(containers: ContainerInfo[], functionsVolPath: string): ContainerInfo[] {
    const target = realPath(functionsVolPath);
    const mounting = containers.filter(c => (c.Mounts || []).some(m => m.Source && realPath(m.Source) === target));
    if (mounting.length) return mounting;

    return containers.filter(c => (c.Image || '').includes('supabase/edge-runtime'));
}

export const containerLabel = (c: ContainerInfo): string => (c.Names?.[0] || c.Id.slice(0, 12)).replace(/^\//, '');
