import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const secretKey = process.env.JWT_SECRET || 'super-secret-key-change-it-in-production';
const encodedKey = new TextEncoder().encode(secretKey);

export function hashPassword(password: string): string {
    // Upgraded to bcrypt for much stronger security (includes auto-salting)
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
}

export function comparePassword(password: string, hash: string): boolean {
    // Legacy support: if the existing hash is 64 characters long and doesn't start with $ (bcrypt format),
    // it was hashed via the old SHA-256 method.
    if (hash.length === 64 && !hash.startsWith('$')) {
        const shaHash = crypto.createHash('sha256').update(password).digest('hex');
        return shaHash === hash;
    }

    // Default standard Bcrypt comparison
    return bcrypt.compareSync(password, hash);
}

export async function createSession(userId: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const session = await new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(encodedKey);

    const cookieStore = await cookies();
    cookieStore.set('session', session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
    });
}

export async function deleteSession() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
}

export async function verifySession() {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;

    if (!session) return null;

    try {
        const { payload } = await jwtVerify(session, encodedKey, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch (error) {
        console.error('Failed to verify session');
        return null;
    }
}
