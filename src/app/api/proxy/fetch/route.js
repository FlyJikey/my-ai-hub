import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
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
