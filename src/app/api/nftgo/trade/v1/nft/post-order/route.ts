import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Received post-order request');

    // Get the request body
    const body = await request.json();
    console.log('Post-order request body:', JSON.stringify(body, null, 2));

    // Forward the request to the NFTGo API
    const nftgoApiKey = process.env.NFTGO_API_KEY;
    if (!nftgoApiKey) {
      console.error('NFTGO_API_KEY is not defined');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Validate that the payload has a signature if it's required
    // Check various possible locations for the signature
    let hasSignature = false;

    if (body.signature) {
      hasSignature = true;
    } else if (body.order && body.order.data && body.order.data.signature) {
      hasSignature = true;
    } else if (body.order && body.order.signature) {
      hasSignature = true;
    } else if (body.data && body.data.signature) {
      hasSignature = true;
    }

    // Log the signature status
    console.log('Signature status in post-order payload:', hasSignature ? 'Found' : 'Missing');

    // Check if this is a payment-processor-v2 order
    if (body.order && body.order.kind === 'payment-processor-v2') {
      console.log('Processing payment-processor-v2 order');

      // Check if we have a signature
      if (body.signature && typeof body.signature === 'string' && body.signature.length >= 132) {
        console.log('Found signature for payment-processor-v2 order, extracting components');

        // Extract r, s from the signature (first 64 bytes, next 64 bytes)
        const r = '0x' + body.signature.slice(2, 66);
        const s = '0x' + body.signature.slice(66, 130);

        // Update the r and s values in the order data if they exist
        if (body.order.data) {
          console.log('Updating r and s values in order.data');
          body.order.data.r = r;
          body.order.data.s = s;
        }
      }
    }
    // Check if this is a seaport order
    else if (body.order && (body.order.kind === 'seaport-v1.5' || body.order.kind === 'seaport-v1.6')) {
      console.log(`Processing ${body.order.kind} order`);

      // Check if we have a signature
      if (body.signature && typeof body.signature === 'string') {
        console.log(`Found signature for ${body.order.kind} order`);

        // Make sure the order.data has the signature
        if (body.order.data) {
          body.order.data.signature = body.signature;

          // Some seaport implementations might use r, s components
          if (body.signature.length >= 132 && 'r' in body.order.data && 's' in body.order.data) {
            console.log('Extracting r and s components for seaport order');
            const r = '0x' + body.signature.slice(2, 66);
            const s = '0x' + body.signature.slice(66, 130);

            body.order.data.r = r;
            body.order.data.s = s;
          }
        }
      }
    }

    // Check if this is for OpenSea
    if (body.orderbook === 'opensea') {
      // Check if bulk_data is present for OpenSea bulk listings
      if (!body.bulk_data && body.order_type === 'listing') {
        console.log('Adding missing bulk_data for OpenSea listing');

        // Get the order_index from order_indexes if available
        let orderIndex = 0;
        if (body.order_indexes && Array.isArray(body.order_indexes) && body.order_indexes.length > 0) {
          orderIndex = body.order_indexes[0];
          console.log(`Using order_index ${orderIndex} from order_indexes`);
        }

        body.bulk_data = {
          kind: 'seaport-v1.6',
          data: {
            order_index: orderIndex,
            merkle_proof: []
          }
        };
      }
    }

    // Log the updated payload
    console.log('Updated payload:', JSON.stringify(body, null, 2));

    // Only enforce signature requirement in production
    if (!hasSignature && process.env.NODE_ENV === 'production') {
      console.error('Missing signature in post-order payload');
      return NextResponse.json(
        { error: 'Missing signature in payload' },
        { status: 400 }
      );
    }

    // Forward to the NFTGo API
    const nftgoResponse = await fetch(`https://data-api.nftgo.io/trade/v1/nft/post-order?chain=ethereum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': nftgoApiKey
      },
      body: JSON.stringify(body)
    });

    // Log the response status
    console.log('NFTGo post-order API response status:', nftgoResponse.status);

    // Get the response body
    const responseData = await nftgoResponse.json();
    console.log('NFTGo post-order API response:', JSON.stringify(responseData, null, 2));

    // Return the response from NFTGo
    return NextResponse.json(responseData, {
      status: nftgoResponse.status
    });
  } catch (error) {
    console.error('Error in post-order API route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
