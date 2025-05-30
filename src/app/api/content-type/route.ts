import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to fetch the content type of a URL
 * This is used to determine the media type of IPFS URLs without extensions
 */
export async function GET(request: NextRequest) {
  // Get the URL from the query parameters
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Make a HEAD request to get the content type
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch content type: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the content type from the response headers
    const contentType = response.headers.get('content-type');

    return NextResponse.json({ contentType });
  } catch (error) {
    console.error('Error fetching content type:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch content type' },
      { status: 500 }
    );
  }
}
