import { NextResponse } from 'next/server';
import { getModels } from '@/lib/omniroute-client';

export async function GET() {
    try {
        const data = await getModels();
        return NextResponse.json(data);
    } catch (error) {
        console.error('OmniRoute models API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch OmniRoute models' },
            { status: 500 }
        );
    }
}
