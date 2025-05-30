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

    // Get the path from the URL
    const path = request.nextUrl.pathname.replace('/api/nftgo/trade', '');

    // Get the request body
    const body = await request.json();

    // Construct the NFTGo API URL
    // Handle specific endpoints
    let nftgoUrl;
    if (path === '/listings') {
      nftgoUrl = `${API_BASE_URL}/trade/v1/nft/listings`;
    } else if (path === '/cancel-orders') {
      nftgoUrl = `${API_BASE_URL}/trade/v1/nft/orders/cancel`;
    } else {
      // Default path handling
      nftgoUrl = `${API_BASE_URL}/trade/v1/nft${path}`;
    }

    console.log('Proxying trading request to NFTGo API:', nftgoUrl);
    console.log('Request body:', JSON.stringify(body));

    // Make the request to NFTGo API
    const response = await fetch(nftgoUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': nftgoApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NFTGo API error:', response.status, errorText);
      return NextResponse.json(
        { error: `NFTGo API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    // Get the data from the response
    const data = await response.json();

    // Return the data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in NFTGo trading proxy API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
