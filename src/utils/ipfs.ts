/**
 * Utility functions for handling IPFS URLs and media types
 */

/**
 * Media type enum for IPFS content
 */
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  UNKNOWN = 'unknown'
}

/**
 * Interface for media information
 */
export interface MediaInfo {
  url: string;
  type: MediaType;
}

/**
 * Converts an IPFS URL to an HTTP URL using a gateway
 *
 * @param ipfsUrl - The IPFS URL to convert (e.g., "ipfs://QmTfARHAjZXV2yYPomwYJwKps53NHEYbrd3jmCzJR97YV2")
 * @param gateway - The gateway to use (default: "https://ipfs.io")
 * @returns The HTTP URL
 */
export function ipfsToHttp(ipfsUrl: string | undefined | null, gateway: string = "https://ipfs.io"): string {
  // Return a placeholder if the URL is undefined or null
  if (!ipfsUrl) {
    return '/images/placeholder-nft.svg';
  }

  // If it's already an HTTP URL, return it as is
  if (ipfsUrl.startsWith('http://') || ipfsUrl.startsWith('https://')) {
    return ipfsUrl;
  }

  // Handle ipfs:// protocol
  if (ipfsUrl.startsWith('ipfs://')) {
    // Remove the ipfs:// prefix
    let cid = ipfsUrl.substring(7);

    // Handle ipfs://ipfs/ format (some NFTs use this format)
    if (cid.startsWith('ipfs/')) {
      cid = cid.substring(5);
    }

    // Return the HTTP URL
    return `${gateway}/ipfs/${cid}`;
  }

  // Handle ipfs:ipfs:// protocol (some NFTs use this format)
  if (ipfsUrl.startsWith('ipfs:ipfs://')) {
    const cid = ipfsUrl.substring(12);
    return `${gateway}/ipfs/${cid}`;
  }

  // If it's just a CID, add the gateway and ipfs prefix
  if (ipfsUrl.match(/^[a-zA-Z0-9]{46,59}$/)) {
    return `${gateway}/ipfs/${ipfsUrl}`;
  }

  // If we can't parse it as an IPFS URL, return it as is
  return ipfsUrl;
}

/**
 * Checks if a URL is an IPFS URL
 *
 * @param url - The URL to check
 * @returns True if the URL is an IPFS URL
 */
export function isIpfsUrl(url: string | undefined | null): boolean {
  if (!url) return false;

  return (
    url.startsWith('ipfs://') ||
    url.startsWith('ipfs:ipfs://') ||
    url.match(/^[a-zA-Z0-9]{46,59}$/) !== null
  );
}

/**
 * Extracts the CID from an IPFS URL
 *
 * @param url - The IPFS URL
 * @returns The CID or null if not found
 */
export function extractCidFromIpfsUrl(url: string | undefined | null): string | null {
  if (!url) return null;

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    // Remove the ipfs:// prefix
    let cid = url.substring(7);

    // Handle ipfs://ipfs/ format
    if (cid.startsWith('ipfs/')) {
      cid = cid.substring(5);
    }

    // Extract just the CID part (before any path)
    const cidPart = cid.split('/')[0];
    return cidPart;
  }

  // Handle ipfs:ipfs:// protocol
  if (url.startsWith('ipfs:ipfs://')) {
    const cid = url.substring(12).split('/')[0];
    return cid;
  }

  // If it's just a CID
  if (url.match(/^[a-zA-Z0-9]{46,59}$/)) {
    return url;
  }

  return null;
}

/**
 * Detects the media type of a URL based on its extension
 *
 * @param url - The URL to check
 * @returns The media type (image, video, audio, or unknown)
 */
export function detectMediaTypeFromExtension(url: string): MediaType {
  if (!url) return MediaType.UNKNOWN;

  // Convert to lowercase for easier comparison
  const lowerUrl = url.toLowerCase();

  // Check for video extensions
  if (
    lowerUrl.endsWith('.mp4') ||
    lowerUrl.endsWith('.webm') ||
    lowerUrl.endsWith('.ogg') ||
    lowerUrl.endsWith('.mov') ||
    lowerUrl.endsWith('.avi') ||
    lowerUrl.endsWith('.m4v')
  ) {
    return MediaType.VIDEO;
  }

  // Check for audio extensions
  if (
    lowerUrl.endsWith('.mp3') ||
    lowerUrl.endsWith('.wav') ||
    lowerUrl.endsWith('.ogg') ||
    lowerUrl.endsWith('.m4a')
  ) {
    return MediaType.AUDIO;
  }

  // Check for image extensions
  if (
    lowerUrl.endsWith('.jpg') ||
    lowerUrl.endsWith('.jpeg') ||
    lowerUrl.endsWith('.png') ||
    lowerUrl.endsWith('.gif') ||
    lowerUrl.endsWith('.webp') ||
    lowerUrl.endsWith('.svg') ||
    lowerUrl.endsWith('.bmp')
  ) {
    return MediaType.IMAGE;
  }

  // If no extension is found, return unknown
  return MediaType.UNKNOWN;
}

/**
 * Detects the media type from a content type string
 *
 * @param contentType - The content type (e.g., "image/jpeg", "video/mp4")
 * @returns The media type (image, video, audio, or unknown)
 */
export function detectMediaTypeFromContentType(contentType: string): MediaType {
  if (!contentType) return MediaType.UNKNOWN;

  const lowerContentType = contentType.toLowerCase();

  if (lowerContentType.startsWith('image/')) {
    return MediaType.IMAGE;
  }

  if (lowerContentType.startsWith('video/')) {
    return MediaType.VIDEO;
  }

  if (lowerContentType.startsWith('audio/')) {
    return MediaType.AUDIO;
  }

  return MediaType.UNKNOWN;
}

/**
 * Fetches the content type of a URL using a HEAD request
 *
 * @param url - The URL to check
 * @returns A promise that resolves to the content type
 */
export async function fetchContentType(url: string): Promise<string | null> {
  try {
    // Use the API route to avoid CORS issues
    const response = await fetch(`/api/content-type?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch content type: ${response.status}`);
    }

    const data = await response.json();
    return data.contentType || null;
  } catch (error) {
    console.error('Error fetching content type:', error);
    return null;
  }
}

/**
 * Gets media information for a URL, including the HTTP URL and media type
 *
 * @param url - The URL to process (can be IPFS or HTTP)
 * @param gateway - The IPFS gateway to use (default: "https://ipfs.io")
 * @returns Media information including URL and type
 */
export async function getMediaInfo(url: string | undefined | null, gateway: string = "https://ipfs.io"): Promise<MediaInfo> {
  if (!url) {
    return {
      url: '/images/placeholder-nft.svg',
      type: MediaType.IMAGE
    };
  }

  // Convert IPFS URL to HTTP URL
  const httpUrl = ipfsToHttp(url, gateway);

  // First try to detect media type from extension
  let mediaType = detectMediaTypeFromExtension(httpUrl);

  // If we couldn't determine the type from the extension, try to fetch the content type
  if (mediaType === MediaType.UNKNOWN) {
    try {
      const contentType = await fetchContentType(httpUrl);
      if (contentType) {
        mediaType = detectMediaTypeFromContentType(contentType);
      }
    } catch (error) {
      console.error('Error detecting media type:', error);
    }
  }

  // If we still couldn't determine the type, default to image
  if (mediaType === MediaType.UNKNOWN) {
    mediaType = MediaType.IMAGE;
  }

  return {
    url: httpUrl,
    type: mediaType
  };
}

/**
 * Gets media information synchronously for a URL, including the HTTP URL and media type
 * This is a fallback for when we can't use async/await
 *
 * @param url - The URL to process (can be IPFS or HTTP)
 * @param gateway - The IPFS gateway to use (default: "https://ipfs.io")
 * @returns Media information including URL and type
 */
export function getMediaInfoSync(url: string | undefined | null, gateway: string = "https://ipfs.io"): MediaInfo {
  if (!url) {
    return {
      url: '/images/placeholder-nft.svg',
      type: MediaType.IMAGE
    };
  }

  // Convert IPFS URL to HTTP URL
  const httpUrl = ipfsToHttp(url, gateway);

  // Try to detect media type from extension
  const mediaType = detectMediaTypeFromExtension(httpUrl);

  return {
    url: httpUrl,
    type: mediaType === MediaType.UNKNOWN ? MediaType.IMAGE : mediaType
  };
}
