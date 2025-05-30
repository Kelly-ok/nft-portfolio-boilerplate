import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://data-api.nftgo.io';

export async function GET(request: NextRequest) {
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

    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const contract = searchParams.get('contract');
    const tokenId = searchParams.get('tokenId');
    const chain = searchParams.get('chain') || 'ethereum';

    // Validate required parameters
    if (!contract || !tokenId) {
      return NextResponse.json(
        { error: 'Missing required parameters: contract and tokenId' },
        { status: 400 }
      );
    }

    console.log(`Fetching NFT data for ${contract}:${tokenId} on ${chain}`);

    // Forward to the NFTGo API
    const nftgoResponse = await fetch(
      `${API_BASE_URL}/eth/v2/nft/${contract}/${tokenId}/info`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': nftgoApiKey
        },
        // Add cache control to prevent browser caching
        cache: 'no-store',
      }
    );

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

    // Log the data structure
    console.log('NFTGo API response structure:', Object.keys(data));

    // Return the data (handle different response structures)
    if (data.data) {
      return NextResponse.json(data.data);
    } else {
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error in NFTGo nft detail API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
