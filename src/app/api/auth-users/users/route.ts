import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Fetch all users
export async function GET() {
    try {
        const sql = `SELECT json_agg(t) FROM (SELECT id, email, created_at, last_sign_in_at FROM auth.users ORDER BY created_at DESC) t;`;

        const { stdout } = await execAsync(`docker exec supabase-db psql -U postgres -d postgres -t -A -c "${sql.replace(/\n/g, ' ')}"`);

        const output = stdout.trim();
        const users = output && output !== '' ? JSON.parse(output) : [];

        return NextResponse.json({ success: true, users });
    } catch (error: unknown) {
        console.error("Fetch Auth Users Error:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// Create a new user natively
export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const sql = `
            DO $$
            DECLARE
                new_user_id UUID := gen_random_uuid();
            BEGIN
                INSERT INTO auth.users (
                    instance_id, id, aud, role, email, encrypted_password,
                    email_confirmed_at, recovery_sent_at, last_sign_in_at,
                    raw_app_meta_data, raw_user_meta_data,
                    created_at, updated_at,
                    confirmation_token, email_change, email_change_token_new, recovery_token
                ) VALUES (
                    '00000000-0000-0000-0000-000000000000',
                    new_user_id,
                    'authenticated', 'authenticated',
                    '${email}',
                    crypt('${password}', gen_salt('bf', 10)),
                    NOW(), NOW(), NULL,
                    '{"provider":"email","providers":["email"]}',
                    '{}',
                    NOW(), NOW(), '', '', '', ''
                );

                INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
                VALUES (
                    new_user_id,
                    new_user_id,
                    jsonb_build_object('sub', new_user_id, 'email', '${email}', 'email_verified', true, 'phone_verified', false),
                    'email', new_user_id,
                    NULL, NOW(), NOW()
                );
            END $$;
        `;

        await execAsync(`docker exec supabase-db psql -U postgres -d postgres -c "${sql.replace(/\n/g, ' ')}"`);

        return NextResponse.json({ success: true, message: 'User created successfully.' });

    } catch (error: unknown) {
        console.error("Create Auth User Error:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// Delete a user
export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const sql = `DELETE FROM auth.users WHERE id = '${id}';`;
        await execAsync(`docker exec supabase-db psql -U postgres -d postgres -c "${sql}"`);

        return NextResponse.json({ success: true, message: 'User deleted successfully.' });

    } catch (error: unknown) {
        console.error("Delete Auth User Error:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
