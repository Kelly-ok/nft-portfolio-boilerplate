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
    if (!body.caller_address || !body.orders || !Array.isArray(body.orders) || body.orders.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: caller_address and orders array are required' },
        { status: 400 }
      );
    }

    console.log('Canceling orders for caller:', body.caller_address);
    console.log('Orders to cancel:', body.orders);

    // Validate each order in the orders array
    const validatedOrders = body.orders.map((order: { order_id: any; order_hash: any; id: string | any[]; order_type: any; }) => {
      // Ensure each order has either order_id or order_hash
      if (!order.order_id && !order.order_hash) {
        console.warn('Order missing both order_id and order_hash:', order);
        // If neither exists, try to use a generic id field if available
        if (order.id) {
          const isHash = order.id.length > 24;
          return {
            [isHash ? 'order_hash' : 'order_id']: order.id,
            order_type: order.order_type || 'listing'
          };
        }
        return null;
      }
      return order;
    }).filter(Boolean); // Remove any null entries

    if (validatedOrders.length === 0) {
      return NextResponse.json(
        { error: 'No valid orders to cancel' },
        { status: 400 }
      );
    }

    // Create a new payload with validated orders
    const validatedPayload = {
      ...body,
      orders: validatedOrders
    };

    console.log('Validated payload for NFTGo API:', JSON.stringify(validatedPayload, null, 2));

    // Forward to the NFTGo API
    const nftgoResponse = await fetch(`https://data-api.nftgo.io/trade/v1/nft/cancel-orders?chain=ethereum`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': nftgoApiKey
      },
      body: JSON.stringify(validatedPayload)
    });

    // Handle NFTGo API response
    if (!nftgoResponse.ok) {
      const errorText = await nftgoResponse.text();
      console.error(`NFTGo API error: ${nftgoResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: `NFTGo API error: ${nftgoResponse.status}`, details: errorText },
        { status: nftgoResponse.status }
      );
    }

    // Return the NFTGo API response
    const data = await nftgoResponse.json();
    console.log('NFTGo cancel orders response:', JSON.stringify(data, null, 2));
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error canceling orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
