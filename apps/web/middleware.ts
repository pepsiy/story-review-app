import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Only run for /admin routes
    if (pathname.startsWith('/admin')) {
        // Skip check for login page itself to avoid infinite loop
        if (pathname === '/admin/login') {
            return NextResponse.next()
        }

        // Check for admin_session cookie
        const adminSession = request.cookies.get('admin_session')

        // If no session, redirect to login
        if (!adminSession) {
            const url = request.nextUrl.clone()
            url.pathname = '/admin/login'
            return NextResponse.redirect(url)
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: '/admin/:path*',
}
