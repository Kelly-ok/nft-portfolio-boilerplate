import { NextRequest, NextResponse } from 'next/server';

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
    if (!body.request_ids || !Array.isArray(body.request_ids)) {
      return NextResponse.json(
        { error: 'Invalid request: request_ids array is required' },
        { status: 400 }
      );
    }

    console.log('Checking post-order results for request IDs:', body.request_ids);

    // Forward to the NFTGo API
    const nftgoResponse = await fetch(`https://data-api.nftgo.io/trade/v1/nft/check-post-order-results?chain=ethereum`, {
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
        { error: `NFTGo API error: ${nftgoResponse.status}` },
        { status: nftgoResponse.status }
      );
    }

    // Return the NFTGo API response
    const data = await nftgoResponse.json();

    // Log the full response for debugging
    console.log('NFTGo check-post-order-results API response:', JSON.stringify(data, null, 2));

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking post-order results:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
