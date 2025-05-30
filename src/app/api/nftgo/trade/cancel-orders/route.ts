import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://data-api.nftgo.io';
const API_KEY = process.env.NFTGO_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();

    // Construct the NFTGo API URL for canceling orders
    const nftgoUrl = `${API_BASE_URL}/trade/v1/nft/orders/cancel`;

    console.log('Proxying cancel orders request to NFTGo API:', nftgoUrl);
    console.log('Request body:', JSON.stringify(body));

    // Make the request to NFTGo API
    const response = await fetch(nftgoUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': API_KEY,
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
    console.error('Error in NFTGo cancel orders proxy API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
