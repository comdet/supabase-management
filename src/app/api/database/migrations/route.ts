import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function GET() {
    try {
        const migrationsDirs = path.join('/tmp', 'database_artifact', 'supabase', 'migrations');
        // also check direct just in case
        const migrationsDirect = path.join('/tmp', 'database_artifact', 'migrations');

        const targetDir = fs.existsSync(migrationsDirs) ? migrationsDirs : (fs.existsSync(migrationsDirect) ? migrationsDirect : null);

        let files: { name: string, version: string }[] = [];

        if (targetDir) {
            const allFiles = fs.readdirSync(targetDir);
            files = allFiles
                .filter(file => file.endsWith('.sql'))
                .map(file => {
                    // Extract version (timestamp prefix usually)
                    const match = file.match(/^(\d+)_/);
                    return {
                        name: file,
                        version: match ? match[1] : file,
                    };
                })
                .sort((a, b) => a.version.localeCompare(b.version));
        }

        // Now query Supabase container for applied migrations
        let appliedVersions: string[] = [];
        try {
            const { stdout } = await execAsync(`docker exec supabase-db psql -U postgres -d postgres -t -c "SELECT version FROM supabase_migrations.schema_migrations;"`);
            appliedVersions = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        } catch (e) {
            console.warn('Could not read schema_migrations table, maybe it does not exist yet', e);
        }

        const mappedFiles = files.map(f => ({
            ...f,
            applied: appliedVersions.includes(f.version)
        }));

        return NextResponse.json({ success: true, migrations: mappedFiles, targetDir });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message, migrations: [] });
    }
}

export async function POST(req: Request) {
    try {
        const { files, targetDir } = await req.json();

        if (!files || !files.length || !targetDir) {
            return NextResponse.json({ error: 'Missing files to execute' }, { status: 400 });
        }

        const results = [];

        for (const file of files) {
            const filePath = path.join(targetDir, file.name);
            const containerTmpPath = `/tmp/execute_migration.sql`;

            // 1. Copy to container
            await execAsync(`docker cp ${filePath} supabase-db:${containerTmpPath}`);

            // 2. Execute
            const res = await execAsync(`docker exec supabase-db psql -U postgres -d postgres -f ${containerTmpPath}`);
            results.push({ name: file.name, output: res.stdout });

            // 3. Mark as executed
            // Note: If using standard Supabase, Supabase CLI usually inserts into schema_migrations itself, BUT since we are executing via psql file, 
            // the file ITSELF doesn't always insert its version unless explicitly written in the SQL.
            // Wait, Standard supabase migration files do NOT have the insert statement. The CLI handles it.
            // So we must manually insert it to keep the state.
            try {
                await execAsync(`docker exec supabase-db psql -U postgres -d postgres -c "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${file.version}') ON CONFLICT DO NOTHING;"`);
            } catch (err) {
                console.error('Failed to update schema_migrations for', file.version, err);
            }
        }

        return NextResponse.json({ success: true, message: 'Migrations applied successfully', results });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
