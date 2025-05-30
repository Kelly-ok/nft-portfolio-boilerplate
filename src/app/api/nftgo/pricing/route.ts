import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://data-api.nftgo.io';

export async function GET(request: NextRequest) {
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

    // Get query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    const contract = searchParams.get('contract');
    const tokenId = searchParams.get('tokenId');

    // Validate required parameters
    if (!contract || !tokenId) {
      return NextResponse.json(
        { error: 'Contract and tokenId parameters are required' },
        { status: 400 }
      );
    }

    // Construct the NFTGo API URL
    const nftgoUrl = `${API_BASE_URL}/pricing/v1/pricing?contract=${contract}&tokenId=${tokenId}`;

    console.log('Proxying request to NFTGo API:', nftgoUrl);

    // Make the request to NFTGo API
    const response = await fetch(nftgoUrl, {
      headers: {
        'X-API-KEY': nftgoApiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('NFTGo API error:', response.status, await response.text());
      return NextResponse.json(
        { error: `NFTGo API error: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the data from the response
    const data = await response.json();

    // Return the data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in NFTGo pricing proxy API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    if (!body || !body.nfts || !Array.isArray(body.nfts)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { nfts: Array<{ contract: string, tokenId: string }> }' },
        { status: 400 }
      );
    }

    // Construct the NFTGo API URL
    const nftgoUrl = `${API_BASE_URL}/pricing/v1/bulk-pricing`;

    console.log('Proxying bulk pricing request to NFTGo API:', nftgoUrl);

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
              { error: `NFTGo API error: ${response.status}` },
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
            { error: 'NFTGo API error: 500' },
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
        { error: 'NFTGo API error: 500' },
        { status: 500 }
      );
    }

    const data = await response.json();

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
