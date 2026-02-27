import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const publicRoutes = ['/login', '/api/auth/login', '/api/auth/logout'];

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // 1. Check API Key for Cron Jobs/Scripts (Only applies to /api/ routes that aren't auth)
    if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) {
        const apiKey = req.headers.get('x-api-key');
        const cronSecret = process.env.CRON_SECRET;
        if (apiKey && cronSecret && apiKey === cronSecret) {
            return NextResponse.next(); // Bypass JWT check if API key is valid
        }
    }

    const isProtectedRoute = path.startsWith('/dashboard') || (path.startsWith('/api/') && !path.startsWith('/api/auth/'));
    const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

    // Skip middleware for unhandled root or public assets
    if (!isProtectedRoute && !isPublicRoute && path !== '/') {
        return NextResponse.next();
    }

    // Redirect root to dashboard
    if (path === '/') {
        return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
    }

    const cookieStore = req.cookies;
    const sessionCookie = cookieStore.get('session')?.value;

    let isValidSession = false;

    if (sessionCookie) {
        try {
            const secretKey = process.env.JWT_SECRET || 'super-secret-key-change-it-in-production';
            const encodedKey = new TextEncoder().encode(secretKey);
            await jwtVerify(sessionCookie, encodedKey, {
                algorithms: ['HS256'],
            });
            isValidSession = true;
        } catch (error) {
            isValidSession = false;
        }
    }

    if (isProtectedRoute && !isValidSession) {
        // Return 401 JSON for API routes instead of redirecting
        if (path.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized. Valid Session Cookie or x-api-key required.' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', req.nextUrl));
    }

    if (isPublicRoute && isValidSession && path === '/login') {
        return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
    }

    return NextResponse.next();
}

export const config = {
    // Exclude static files and next.js internals, but run on all pages and APIs
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
