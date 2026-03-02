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

        const seedPath1 = path.join('/tmp', 'database_artifact', 'supabase', 'seed.sql');
        const seedPath2 = path.join('/tmp', 'database_artifact', 'seed.sql');
        const hasSeed = fs.existsSync(seedPath1) || fs.existsSync(seedPath2);

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

        return NextResponse.json({ success: true, migrations: mappedFiles, targetDir, hasSeed });

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

        // 0. Ensure schema_migrations table exists (Replicating native Supabase CLI 'history.go' logic)
        try {
            await execAsync(`docker exec supabase-db psql -U postgres -d postgres -c "SET lock_timeout = '4s'; CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text NOT NULL PRIMARY KEY); ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN IF NOT EXISTS statements text[]; ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN IF NOT EXISTS name text;"`);
        } catch (err) {
            console.error('Failed to initialize schema_migrations table natively', err);
            return NextResponse.json({ error: 'Failed to initialize schema_migrations table natively' }, { status: 500 });
        }

        for (const file of files) {
            const filePath = path.join(targetDir, file.name);
            const containerTmpPath = `/tmp/execute_migration.sql`;

            // 1. Copy to container
            await execAsync(`docker cp ${filePath} supabase-db:${containerTmpPath}`);

            // 2. Execute
            const res = await execAsync(`docker exec supabase-db psql -U postgres -d postgres -f ${containerTmpPath}`);
            results.push({ name: file.name, output: res.stdout });

            // 3. Mark as executed
            // Use native UPSERT standard from Supabase CLI history.go
            try {
                // Remove the .sql extension from the name if needed, or keep the whole thing. 
                // The CLI inserts the base name without .sql sometimes, but we'll insert file.name as the name.
                await execAsync(`docker exec supabase-db psql -U postgres -d postgres -c "INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES('${file.version}', '${file.name}', null) ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name, statements = EXCLUDED.statements;"`);
            } catch (err) {
                console.error('Failed to upsert schema_migrations for', file.version, err);
            }
        }

        return NextResponse.json({ success: true, message: 'Migrations applied successfully', results });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
