import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://data-api.nftgo.io';
const API_KEY = process.env.NFTGO_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || 'ethereum';

    // Get the request body
    const body = await request.json();

    // Log the request body for debugging
    console.log('Request body received:', JSON.stringify(body, null, 2));

    // Construct the NFTGo API URL for creating listings
    const nftgoUrl = `${API_BASE_URL}/trade/v1/nft/create-listings?chain=${chain}`;

    console.log('Proxying create-listings request to NFTGo API:', nftgoUrl);

    // Make the request to NFTGo API exactly as in the example
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

    // Log the full response for debugging
    console.log('NFTGo create-listings API response:', JSON.stringify(data, null, 2));

    // Validate and enhance the response data
    if (data.code === 'SUCCESS' && data.data && Array.isArray(data.data.actions)) {
      console.log(`Received ${data.data.actions.length} actions from NFTGo API`);

      // Validate transaction actions
      data.data.actions.forEach((action: any, index: number) => {
        console.log(`Action ${index + 1} - Kind: ${action.kind}, Name: ${action.name}`);

        if (action.kind === 'transaction') {
          // Validate transaction data
          if (!action.data || !action.data.to || !action.data.to.startsWith('0x')) {
            console.error(`Invalid transaction data in action ${index + 1}:`, action.data);
          } else {
            console.log(`Transaction action ${index + 1} details:`, {
              to: action.data.to,
              hasData: !!action.data.data,
              dataLength: action.data.data?.length,
              value: action.data.value,
              from: action.data.from
            });
          }
        }
      });
    } else {
      console.warn('Unexpected response format from NFTGo API:', data);
    }

    // Return the data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in NFTGo create-listings API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
