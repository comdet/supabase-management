import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST() {
    try {
        const seedPath1 = path.join('/tmp', 'database_artifact', 'supabase', 'seed.sql');
        const seedPath2 = path.join('/tmp', 'database_artifact', 'seed.sql');

        const targetSeed = fs.existsSync(seedPath1) ? seedPath1 : (fs.existsSync(seedPath2) ? seedPath2 : null);

        if (!targetSeed) {
            return NextResponse.json({ error: 'seed.sql not found in the downloaded artifact. Make sure to download an artifact first.' }, { status: 404 });
        }

        const containerTmpPath = `/tmp/execute_seed.sql`;

        // 1. Copy to container
        await execAsync(`docker cp ${targetSeed} supabase-db:${containerTmpPath}`);

        // 2. Execute
        const { stdout } = await execAsync(`docker exec supabase-db psql -U postgres -d postgres -f ${containerTmpPath}`);

        return NextResponse.json({ success: true, message: 'Seed applied successfully', output: stdout });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
