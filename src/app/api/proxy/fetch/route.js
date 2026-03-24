import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // SSRF protection: validate URL
    try {
        const parsedUrl = new URL(url);
        
        // Only allow http/https protocols
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json({ error: 'Only HTTP/HTTPS protocols are allowed' }, { status: 400 });
        }

        // Block private IP ranges and localhost
        const hostname = parsedUrl.hostname.toLowerCase();
        const blockedPatterns = [
            /^localhost$/i,
            /^127\./,
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^192\.168\./,
            /^169\.254\./,
            /^::1$/,
            /^fe80:/i,
            /^fc00:/i,
            /^fd00:/i,
            // Block cloud metadata endpoints
            /169\.254\.169\.254/,
            /metadata\.google\.internal/i,
        ];

        if (blockedPatterns.some(pattern => pattern.test(hostname))) {
            return NextResponse.json({ error: 'Access to private/internal addresses is not allowed' }, { status: 403 });
        }
    } catch (urlError) {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            redirect: 'manual' // Prevent automatic redirects to internal addresses
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove scripts, styles, and other non-content elements
        $('script, style, nav, footer, header, ads, .ads, #ads').remove();

        // Extract title and main text
        const title = $('title').text() || $('h1').first().text();
        let mainText = $('main, article, .content, #content').text();

        if (!mainText || mainText.length < 200) {
            mainText = $('body').text();
        }

        // Clean up text
        const cleanText = mainText
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 10000); // Limit to 10k chars

        return NextResponse.json({
            title,
            content: cleanText,
            url
        });
    } catch (error) {
        console.error('Proxy fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
