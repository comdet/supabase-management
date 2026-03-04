import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ROLES = ['service_role', 'authenticated', 'anon'] as const;
const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;

// Whitelist for table names to prevent SQL injection
const TABLE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function sanitizeTableName(name: string): string | null {
    return TABLE_NAME_REGEX.test(name) ? name : null;
}

function sanitizeRole(role: string): string | null {
    return (ROLES as readonly string[]).includes(role) ? role : null;
}

function sanitizePrivilege(priv: string): string | null {
    return (PRIVILEGES as readonly string[]).includes(priv.toUpperCase()) ? priv.toUpperCase() : null;
}

export async function GET() {
    try {
        // Query all tables in public schema with their grant status for each role
        const sql = `
            SELECT t.tablename,
                has_table_privilege('service_role', 'public.' || t.tablename, 'SELECT') as sr_select,
                has_table_privilege('service_role', 'public.' || t.tablename, 'INSERT') as sr_insert,
                has_table_privilege('service_role', 'public.' || t.tablename, 'UPDATE') as sr_update,
                has_table_privilege('service_role', 'public.' || t.tablename, 'DELETE') as sr_delete,
                has_table_privilege('authenticated', 'public.' || t.tablename, 'SELECT') as auth_select,
                has_table_privilege('authenticated', 'public.' || t.tablename, 'INSERT') as auth_insert,
                has_table_privilege('authenticated', 'public.' || t.tablename, 'UPDATE') as auth_update,
                has_table_privilege('authenticated', 'public.' || t.tablename, 'DELETE') as auth_delete,
                has_table_privilege('anon', 'public.' || t.tablename, 'SELECT') as anon_select,
                has_table_privilege('anon', 'public.' || t.tablename, 'INSERT') as anon_insert,
                has_table_privilege('anon', 'public.' || t.tablename, 'UPDATE') as anon_update,
                has_table_privilege('anon', 'public.' || t.tablename, 'DELETE') as anon_delete
            FROM pg_tables t
            WHERE t.schemaname = 'public'
            ORDER BY t.tablename;
        `.replace(/\n/g, ' ').trim();

        const { stdout } = await execAsync(
            `docker exec supabase-db psql -U postgres -d postgres -t -A -F '|' -c "${sql}"`
        );

        const lines = stdout.split('\n').filter(l => l.trim().length > 0);
        const tables = lines.map(line => {
            const cols = line.split('|');
            return {
                name: cols[0],
                service_role: {
                    select: cols[1] === 't',
                    insert: cols[2] === 't',
                    update: cols[3] === 't',
                    delete: cols[4] === 't',
                },
                authenticated: {
                    select: cols[5] === 't',
                    insert: cols[6] === 't',
                    update: cols[7] === 't',
                    delete: cols[8] === 't',
                },
                anon: {
                    select: cols[9] === 't',
                    insert: cols[10] === 't',
                    update: cols[11] === 't',
                    delete: cols[12] === 't',
                },
            };
        });

        // Check if default privileges are set
        const defPrivSql = `SELECT defaclrole::regrole::text, defaclobjtype, defaclacl::text FROM pg_default_acl WHERE defaclnamespace = 'public'::regnamespace;`;
        let defaultPrivileges: string[] = [];
        try {
            const { stdout: defOut } = await execAsync(
                `docker exec supabase-db psql -U postgres -d postgres -t -A -F '|' -c "${defPrivSql}"`
            );
            defaultPrivileges = defOut.split('\n').filter(l => l.trim().length > 0);
        } catch {
            // Not critical
        }

        const hasDefaultPrivileges = defaultPrivileges.some(l => l.includes('service_role'));

        return NextResponse.json({ success: true, tables, hasDefaultPrivileges });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message, tables: [] }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action } = body;

        let sql = '';
        let description = '';

        switch (action) {
            case 'grant_all_service_role': {
                sql = `GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;`;
                description = 'Granted ALL privileges on all public tables to service_role';
                break;
            }

            case 'setup_default_privileges': {
                sql = `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;`;
                description = 'Default privileges configured for service_role';
                break;
            }

            case 'grant_table': {
                const table = sanitizeTableName(body.table);
                const role = sanitizeRole(body.role);
                const privilege = sanitizePrivilege(body.privilege);
                if (!table || !role || !privilege) {
                    return NextResponse.json({ error: 'Invalid table, role, or privilege' }, { status: 400 });
                }
                sql = `GRANT ${privilege} ON TABLE public.${table} TO ${role};`;
                description = `Granted ${privilege} on ${table} to ${role}`;
                break;
            }

            case 'revoke_table': {
                const table = sanitizeTableName(body.table);
                const role = sanitizeRole(body.role);
                const privilege = sanitizePrivilege(body.privilege);
                if (!table || !role || !privilege) {
                    return NextResponse.json({ error: 'Invalid table, role, or privilege' }, { status: 400 });
                }
                sql = `REVOKE ${privilege} ON TABLE public.${table} FROM ${role};`;
                description = `Revoked ${privilege} on ${table} from ${role}`;
                break;
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

        const { stdout, stderr } = await execAsync(
            `docker exec supabase-db psql -U postgres -d postgres -c "${sql}"`
        );

        return NextResponse.json({
            success: true,
            message: description,
            output: stdout || stderr
        });

    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
