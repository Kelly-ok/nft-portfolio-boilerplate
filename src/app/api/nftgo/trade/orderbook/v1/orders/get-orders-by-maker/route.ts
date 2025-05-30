import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache for API responses
// This helps reduce the number of API calls to NFTGo
const responseCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL (increased from 60 seconds)

// Rate limiting state
const requestCounts = new Map<string, { count: number, resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 5; // Maximum requests per minute per wallet address (reduced from 10)

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
    if (!body.maker) {
      return NextResponse.json(
        { error: 'Invalid request: maker address is required' },
        { status: 400 }
      );
    }

    const walletAddress = body.maker.toLowerCase();
    const cacheKey = `${walletAddress}-${body.orderbook || 'all'}-${body.limit || 100}`;
    const forceRefresh = body.forceRefresh === true;

    // Check if we have a cached response and forceRefresh is not true
    const cachedResponse = responseCache.get(cacheKey);
    if (!forceRefresh && cachedResponse && (Date.now() - cachedResponse.timestamp) < CACHE_TTL) {
      console.log(`Using cached response for orders by maker: ${walletAddress}`);
      return NextResponse.json(cachedResponse.data);
    }

    // Log if we're force refreshing
    if (forceRefresh) {
      console.log(`Force refreshing orders for maker: ${walletAddress}, bypassing API cache`);
    }

    // Apply rate limiting per wallet address
    const now = Date.now();
    const rateLimit = requestCounts.get(walletAddress) || { count: 0, resetTime: now + 60000 };

    // Reset count if the minute has passed
    if (now > rateLimit.resetTime) {
      rateLimit.count = 0;
      rateLimit.resetTime = now + 60000;
    }

    // Check if rate limit exceeded
    if (rateLimit.count >= MAX_REQUESTS_PER_MINUTE) {
      console.warn(`Rate limit exceeded for wallet: ${walletAddress}`);
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Increment request count
    rateLimit.count++;
    requestCounts.set(walletAddress, rateLimit);

    console.log(`Fetching orders by maker: ${walletAddress} (Request ${rateLimit.count}/${MAX_REQUESTS_PER_MINUTE})`);

    // Prepare the request body for NFTGo API (remove forceRefresh as it's not part of NFTGo API)
    const nftgoRequestBody = {
      maker: body.maker,
      order_type: body.order_type || 'listing',
      include_private: false,
      offset: 0,
      limit: body.limit || 100
    };

    // Build the URL with query parameters
    let nftgoUrl = `https://data-api.nftgo.io/orderbook/v1/orders/get-orders-by-maker?chain=ethereum`;

    // Add order_book_name if orderbook is provided
    if (body.orderbook) {
      console.log(`Filtering orders by orderbook: ${body.orderbook}`);
      nftgoUrl += `&order_book_name=${body.orderbook}`;
    }

    console.log('NFTGo API URL:', nftgoUrl);
    console.log('NFTGo API request body:', JSON.stringify(nftgoRequestBody, null, 2));

    // Forward to the NFTGo API
    const nftgoResponse = await fetch(nftgoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': nftgoApiKey
      },
      body: JSON.stringify(nftgoRequestBody),
      // Add cache control to prevent browser caching
      cache: 'no-store',
    });

    // Handle NFTGo API response
    if (!nftgoResponse.ok) {
      const errorText = await nftgoResponse.text();
      console.error(`NFTGo API error: ${nftgoResponse.status} - ${errorText}`);

      // If rate limited by NFTGo, return a 429 response
      if (nftgoResponse.status === 429) {
        return NextResponse.json(
          { error: 'NFTGo API rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `NFTGo API error: ${nftgoResponse.status}` },
        { status: nftgoResponse.status }
      );
    }

    // Parse and cache the response
    const data = await nftgoResponse.json();

    // Debug: Log the response structure
    console.log('NFTGo API response for get-orders-by-maker:', {
      code: data.code,
      msg: data.msg,
      hasData: !!data.data,
      dataKeys: data.data ? Object.keys(data.data) : [],
      listingDtosLength: data.data?.listing_dtos?.length || 0,
      walletAddress: walletAddress
    });

    responseCache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching orders by maker:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
