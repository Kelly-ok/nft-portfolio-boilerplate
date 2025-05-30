import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://data-api.nftgo.io';

export async function POST(request: NextRequest) {
  try {
    console.log('Received create-listings request');

    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || 'ethereum';

    // Get the request body
    const body = await request.json();
    console.log('Create listings request body:', JSON.stringify(body, null, 2));

    // Forward the request to the NFTGo API
    const nftgoApiKey = process.env.NFTGO_API_KEY;
    if (!nftgoApiKey) {
      console.error('NFTGO_API_KEY is not defined');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Forward to the NFTGo API
    const nftgoResponse = await fetch(`${API_BASE_URL}/trade/v1/nft/create-listings?chain=${chain}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': nftgoApiKey
      },
      body: JSON.stringify(body)
    });

    // Log the response status
    console.log('NFTGo create-listings API response status:', nftgoResponse.status);

    if (!nftgoResponse.ok) {
      const errorText = await nftgoResponse.text();
      console.error('NFTGo API error:', nftgoResponse.status, errorText);
      return NextResponse.json(
        { error: `NFTGo API error: ${nftgoResponse.status}`, details: errorText },
        { status: nftgoResponse.status }
      );
    }

    // Get the response body
    const responseData = await nftgoResponse.json();
    console.log('NFTGo create-listings API response:', JSON.stringify(responseData, null, 2));

    // Validate and enhance the response data
    if (responseData.code === 'SUCCESS' && responseData.data && Array.isArray(responseData.data.actions)) {
      console.log(`Received ${responseData.data.actions.length} actions from NFTGo API`);

      // Validate transaction actions
      responseData.data.actions.forEach((action: any, index: number) => {
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
      console.warn('Unexpected response format from NFTGo API:', responseData);
    }

    // Return the response from NFTGo
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in create-listings API route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
