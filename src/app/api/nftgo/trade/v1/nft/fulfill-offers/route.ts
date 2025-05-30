import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://data-api.nftgo.io';

export async function POST(request: NextRequest) {
  try {
    // Get the NFTGo API key from environment variables
    const nftgoApiKey = process.env.NFTGO_API_KEY;

    if (!nftgoApiKey) {
      console.error('NFTGO_API_KEY is not defined in environment variables');
      return NextResponse.json(
        { error: 'API key configuration error' },
        { status: 500 }
      );
    }

    // Parse the request body
    const body = await request.json();

    // Validate the request body
    if (!body.caller_address || !body.orders || !Array.isArray(body.orders) || body.orders.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: caller_address and orders array are required' },
        { status: 400 }
      );
    }

    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || 'ethereum';

    console.log('Fulfill offers request body:', JSON.stringify(body, null, 2));

    // Forward to the NFTGo API
    const nftgoResponse = await fetch(`${API_BASE_URL}/trade/v1/nft/fulfill-offers?chain=${chain}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': nftgoApiKey
      },
      body: JSON.stringify(body)
    });

    // Handle NFTGo API response
    if (!nftgoResponse.ok) {
      const errorText = await nftgoResponse.text();
      console.error(`NFTGo API error: ${nftgoResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: `NFTGo API error: ${nftgoResponse.status}`, details: errorText },
        { status: nftgoResponse.status }
      );
    }

    // Get the data from the response
    const data = await nftgoResponse.json();

    // Return the data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in NFTGo fulfill-offers API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
