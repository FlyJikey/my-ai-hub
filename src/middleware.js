import { NextResponse } from 'next/server';

export function middleware(request) {
    const origin = request.headers.get('origin') ?? '*';

    // Handle preflight OPTIONS request specifically
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-version, x-csrftoken, x-requested-with',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // Handle other requests
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-version, x-csrftoken, x-requested-with');

    return response;
}

export const config = {
    matcher: '/api/:path*',
};
