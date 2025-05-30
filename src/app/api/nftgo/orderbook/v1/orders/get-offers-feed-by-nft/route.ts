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
    if (!body.contract_address) {
      return NextResponse.json(
        { error: 'Invalid request: contract_address is required' },
        { status: 400 }
      );
    }

    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || 'ethereum';
    const limit = searchParams.get('limit') || '50';

    console.log(`Fetching offers for NFT: ${body.contract_address}:${body.token_id || 'collection-wide'}`);

    // Forward to the NFTGo API
    const nftgoResponse = await fetch(`${API_BASE_URL}/orderbook/v1/orders/get-offers-feed-by-nft?chain=${chain}&limit=${limit}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': nftgoApiKey
      },
      body: JSON.stringify(body),
      // Add cache control to prevent browser caching
      cache: 'no-store',
    });

    // Handle NFTGo API response
    if (!nftgoResponse.ok) {
      const errorText = await nftgoResponse.text();
      console.error(`NFTGo API error: ${nftgoResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: `NFTGo API error: ${nftgoResponse.status}` },
        { status: nftgoResponse.status }
      );
    }

    // Get the data from the response
    const data = await nftgoResponse.json();

    // Return the data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in NFTGo get-offers-feed-by-nft API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
