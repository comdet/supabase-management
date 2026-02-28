import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function GET() {
    try {
        // Generate a filename based on current timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `dump_public_${timestamp}.sql`;
        const hostPath = path.join('/tmp', fileName);

        // Use docker exec pg_dump into a file INSIDE the container first, 
        // to avoid any stdout pipe encoding issues on windows.
        const containerPath = `/tmp/${fileName}`;

        // 1. Dump to container path
        await execAsync(`docker exec supabase-db pg_dump -U postgres -F p -n public postgres -f ${containerPath}`);

        // 2. Copy out from container safely
        await execAsync(`docker cp supabase-db:${containerPath} ${hostPath}`);

        // Read file content
        const fs = await import('fs');
        const content = fs.readFileSync(hostPath, 'utf8');

        // Clean up
        fs.unlinkSync(hostPath);
        await execAsync(`docker exec supabase-db rm ${containerPath}`);

        return new NextResponse(content, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Type': 'application/sql',
            }
        });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
