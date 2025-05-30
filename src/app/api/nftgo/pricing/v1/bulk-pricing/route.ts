import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://data-api.nftgo.io';

// Simple in-memory rate limiting
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const MAX_REQUESTS_PER_WINDOW = 2; // Allow 2 requests per 10 seconds (increased from 1)
let lastRequestTime = 0;
let requestCount = 0;

// Cache system with support for multiple batch requests
const responseCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes cache TTL (increased from 1 minute)

// Maximum number of NFTs to process in a single request
const MAX_BATCH_SIZE = 50;

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

    // Get the request body
    const body = await request.json();

    // Validate the request body
    if (!body || !body.params || !Array.isArray(body.params)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { params: Array<{ contract_address: string, token_id: string }>, with_weights?: boolean }' },
        { status: 400 }
      );
    }

    // Generate a cache key based on the request parameters
    const cacheKey = generateCacheKey(body.params);

    // Check if we have a valid cached response for this exact request
    if (responseCache.has(cacheKey)) {
      const cachedData = responseCache.get(cacheKey)!;
      if (Date.now() - cachedData.timestamp < CACHE_TTL) {
        console.log('Returning cached bulk pricing response');
        return NextResponse.json(cachedData.data);
      } else {
        // Remove expired cache entry
        responseCache.delete(cacheKey);
      }
    }

    // Check if the batch size exceeds the maximum
    if (body.params.length > MAX_BATCH_SIZE) {
      console.log(`Request batch size (${body.params.length}) exceeds maximum (${MAX_BATCH_SIZE}). The client should handle batching.`);
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} NFTs. Please split your request into smaller batches.` },
        { status: 400 }
      );
    }

    // Implement rate limiting
    const now = Date.now();

    // Reset counter if we're in a new window
    if (now - lastRequestTime > RATE_LIMIT_WINDOW) {
      requestCount = 0;
      lastRequestTime = now;
    }

    // Increment request counter
    requestCount++;

    // Check if we've exceeded the rate limit
    if (requestCount > MAX_REQUESTS_PER_WINDOW) {
      console.log('Rate limit exceeded for bulk pricing API');
      return NextResponse.json(
        { error: 'Rate Limit Exceeded', details: JSON.stringify({ msg: 'Rate Limit Exceeded' }) },
        { status: 429 }
      );
    }

    // Construct the NFTGo API URL
    const nftgoUrl = `${API_BASE_URL}/pricing/v1/bulk-pricing`;

    console.log('Proxying bulk pricing request to NFTGo API:', nftgoUrl);
    console.log(`Request contains ${body.params.length} NFTs`);

    // Make the request to NFTGo API with retry logic
    const maxRetries = 2; // Total of 3 attempts (initial + 2 retries)
    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add delay before retry attempts (not on first attempt)
        if (attempt > 0) {
          console.log(`Retrying NFTGo API request (attempt ${attempt + 1}/${maxRetries + 1}) after 1 second delay`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

        response = await fetch(nftgoUrl, {
          method: 'POST',
          headers: {
            'X-API-KEY': nftgoApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(body),
          // Add cache control to prevent browser caching
          cache: 'no-store',
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`NFTGo API error: ${response.status}`);

          // Only retry on 500 errors
          if (response.status === 500 && attempt < maxRetries) {
            console.error(`NFTGo API error: ${response.status} (attempt ${attempt + 1}/${maxRetries + 1})`, errorText);
            lastError = error;
            continue; // Try again
          } else {
            // Don't retry for other errors or if we've exhausted retries
            console.error('NFTGo API error:', response.status, errorText);
            return NextResponse.json(
              { error: `NFTGo API error: ${response.status}`, details: errorText },
              { status: response.status }
            );
          }
        }

        // Success - break out of retry loop
        break;
      } catch (error) {
        lastError = error as Error;

        // If this is not a 500 error or we've exhausted retries, throw immediately
        if (attempt === maxRetries) {
          console.error('All retry attempts failed:', lastError);
          return NextResponse.json(
            { error: 'NFTGo API error: 500', details: 'All retry attempts failed' },
            { status: 500 }
          );
        }

        // Continue to next retry attempt
        console.error(`Error on attempt ${attempt + 1}/${maxRetries + 1}:`, error);
      }
    }

    // Get the data from the response (response should be non-null here)
    if (!response) {
      return NextResponse.json(
        { error: 'NFTGo API error: 500', details: 'No response received after retries' },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log(`Received pricing data for ${data.data?.length || 0} NFTs`);

    // Cache the response with the specific cache key
    responseCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    // Clean up old cache entries if there are too many
    if (responseCache.size > 20) {
      // Keep only the 10 most recent entries
      const entries = Array.from(responseCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);

      for (let i = 10; i < entries.length; i++) {
        responseCache.delete(entries[i][0]);
      }
    }

    // Return the data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in NFTGo bulk pricing proxy API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate a cache key based on the NFT parameters
 */
function generateCacheKey(params: any[]): string {
  if (!params || params.length === 0) return '';

  // Sort by contract and token ID to ensure consistent cache keys
  const sortedParams = [...params].sort((a, b) => {
    const keyA = `${a.contract_address}:${a.token_id}`;
    const keyB = `${b.contract_address}:${b.token_id}`;
    return keyA.localeCompare(keyB);
  });

  // Create a string of contract:tokenId pairs
  return sortedParams.map(param => `${param.contract_address}:${param.token_id}`).join('|');
}
