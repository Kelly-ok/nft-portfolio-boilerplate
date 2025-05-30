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
    const address = searchParams.get('address');
    const limit = searchParams.get('limit') || '20';
    const sortBy = searchParams.get('sort_by') || 'receivedTime';
    const asc = searchParams.get('asc') || 'false';
    const cursor = searchParams.get('cursor') || '';

    // Validate required parameters
    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    // Construct the NFTGo API URL
    let nftgoUrl = `${API_BASE_URL}/eth/v3/address/nfts?address=${address}&limit=${limit}&sort_by=${sortBy}&asc=${asc}`;

    // Add cursor if provided
    if (cursor) {
      nftgoUrl += `&cursor=${cursor}`;
    }

    console.log('Proxying request to NFTGo API:', nftgoUrl);

    // Make the request to NFTGo API
    const response = await fetch(nftgoUrl, {
      headers: {
        'X-API-KEY': nftgoApiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('NFTGo API error:', response.status, await response.text());
      return NextResponse.json(
        { error: `NFTGo API error: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the data from the response
    const data = await response.json();

    // Return the data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in NFTGo proxy API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
