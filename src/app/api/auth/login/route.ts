import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';
import { hashPassword, comparePassword, createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
        }

        // Check if the users table is empty (Edge case if DB hasn't initialized yet)
        const { count } = await dbGet('SELECT COUNT(*) as count FROM users');
        if (count === 0) {
            return NextResponse.json({ error: 'Database is still initializing, please try again.' }, { status: 503 });
        }

        // Normal login flow
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);

        if (!user) {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        if (!comparePassword(password, user.password_hash)) {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        // Login successful
        await createSession(user.id.toString());

        return NextResponse.json({ message: 'Logged in successfully' });

    } catch (error) {
        console.error('Login error', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET() {
    // Check if the system needs setup (0 users)
    try {
        const result = await dbGet('SELECT COUNT(*) as count FROM users');
        return NextResponse.json({ needsSetup: result.count === 0 });
    } catch (error) {
        return NextResponse.json({ needsSetup: false });
    }
}
