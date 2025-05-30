import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

export async function GET(request: NextRequest) {
  try {
    // Get the Moralis API key from environment variables
    const moralisApiKey = process.env.MORALIS_API_KEY;

    if (!moralisApiKey) {
      console.error('MORALIS_API_KEY is not defined in environment variables');
      return NextResponse.json(
        { error: 'API key configuration error' },
        { status: 500 }
      );
    }

    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('address');
    const chainId = searchParams.get('chainId') || '1'; // Default to Ethereum mainnet

    // Validate required parameters
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address parameter is required' },
        { status: 400 }
      );
    }

    // Construct the Moralis API URL
    // Don't exclude spam NFTs as we need to check the possible_spam field ourselves
    const moralisUrl = `${API_BASE_URL}/${walletAddress}/nft?chain=0x${chainId}&format=decimal&normalizeMetadata=true&media_items=true&include_prices=true&exclude_spam=false`;

    console.log('Proxying request to Moralis API:', moralisUrl);

    // Make the request to Moralis API
    const response = await fetch(moralisUrl, {
      headers: {
        'X-API-Key': moralisApiKey,
        'Accept': 'application/json',
      },
      // Add cache control to prevent browser caching
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Moralis API error:', response.status, await response.text());
      return NextResponse.json(
        { error: `Moralis API error: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the response data
    const data = await response.json();

    // Return the data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in Moralis NFTs API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
