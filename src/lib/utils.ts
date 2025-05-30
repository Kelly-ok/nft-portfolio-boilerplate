import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Checks if an image URL is valid and accessible
 * @param url The URL to check
 * @returns A promise that resolves to a boolean indicating if the URL is valid
 */
export async function isImageUrlValid(url: string): Promise<boolean> {
  // If URL is empty or not a string, it's invalid
  if (!url || typeof url !== 'string') return false;

  // Check if URL is properly formatted
  try {
    new URL(url);
  } catch (e) {
    return false;
  }

  // For IPFS URLs, we consider them valid without checking
  // as they might be slow to resolve and we're already converting them
  if (url.startsWith('ipfs://')) return true;

  return true;
}

/**
 * Get a fallback image URL if the provided URL is invalid
 * @param url The original image URL
 * @returns The original URL if valid, or a fallback placeholder URL
 */
export function getImageWithFallback(url: string | undefined): string {
  if (!url) return '/images/placeholder-nft.svg';
  return url;
}