import { NFT, MarketplaceListing, MarketplaceComparisonData } from '@/types';
import { devLog, devError, devWarn } from '@/lib/dev-utils';

// NFTGo API configuration - using our proxy API route
const API_BASE_URL = '/api/nftgo';

// Default placeholder image for invalid or missing NFT images
const DEFAULT_NFT_IMAGE = '/images/placeholder-nft.svg';

/**
 * Validates if a URL string is properly formatted
 * @param url The URL string to validate
 * @returns boolean indicating if the URL is valid
 */
function isValidUrl(url: string): boolean {
  if (!url) return false;

  try {
    new URL(url);
    return true;
  } catch {
    // Ignore the error and return false for invalid URLs
    return false;
  }
}

/**
 * Get NFTs owned by a wallet address from NFTGo
 */
export async function getNFTsByWalletNFTGo(walletAddress: string): Promise<NFT[]> {
  try {
    devLog('Fetching NFTs from NFTGo for wallet:', walletAddress);

    // Call our proxy API route to get NFTs for the wallet (Ethereum only)
    // Using the correct parameters: address, limit, sort_by, asc, cursor
    const response = await fetch(
      `${API_BASE_URL}/nfts?address=${walletAddress}&limit=50&sort_by=receivedTime&asc=false`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      devError('NFTGo API error response:', errorText);
      throw new Error(`NFTGo API error: ${response.status}`);
    }

    const data = await response.json();
    devLog('NFTGo API response received');

    // Check if we have valid data
    if (!data || !Array.isArray(data.nfts)) {
      devWarn('No NFTs found in NFTGo response or invalid response format');
      return [];
    }

    devLog(`Found ${data.nfts.length} NFTs in the response`);

    // Store the next_cursor for potential pagination in the future
    if (data.next_cursor) {
      devLog('Next cursor available for pagination:', data.next_cursor);
      // We could store this in state or context for implementing "load more" functionality
    }

    // Map NFTGo API response to our NFT format
    return data.nfts.map((nft: any) => {
      // Extract image URL
      let imageUrl = nft.image || '';

      // Use animation_url as fallback if available
      if ((!imageUrl || !isValidUrl(imageUrl)) && nft.animation_url) {
        imageUrl = nft.animation_url;
      }

      // Validate image URL
      if (!isValidUrl(imageUrl)) {
        imageUrl = DEFAULT_NFT_IMAGE;
      }

      return {
        id: `${nft.contract_address}:${nft.token_id}`,
        name: nft.name || `#${nft.token_id}`,
        description: nft.description || '',
        image: imageUrl,
        tokenId: nft.token_id,
        contractAddress: nft.contract_address,
        owner: walletAddress,
        collection: {
          name: nft.collection_name || 'Unknown Collection',
          // Use collection slug for potential image lookup
          slug: nft.collection_slug || '',
          opensea_slug: nft.collection_opensea_slug || ''
        },
        metadata: {
          contract_type: nft.contract_type,
          blockchain: nft.blockchain,
          animation_url: nft.animation_url,
          // Include rarity data if available
          rarity: nft.rarity || {}
        },
        // Include last sale data if available
        lastPrice: nft.last_sale?.price || 0,
        currency: nft.last_sale?.currency || 'ETH',
        // Create a deep copy of traits to ensure each NFT has its own attributes array
        attributes: Array.isArray(nft.traits)
          ? nft.traits.map((trait: any) => ({
              trait_type: trait.type || '',
              value: trait.value || '',
              ...(trait.percentage !== undefined && { rarity_percentage: trait.percentage })
            }))
          : [],
        // Check if NFT is suspicious/spam
        isSpam: nft.rarity?.suspicious || false
      };
    }).filter((nft: NFT) => !nft.isSpam); // Filter out spam NFTs
  } catch (error) {
    devError('Error fetching NFTs from NFTGo:', error);
    throw error;
  }
}

/**
 * Get estimated price for a single NFT
 */
export async function getNFTPriceEstimate(contractAddress: string, tokenId: string): Promise<number> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/pricing?contract=${contractAddress}&tokenId=${tokenId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`NFTGo pricing API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.data && data.data.price) {
      return data.data.price;
    }

    return 0;
  } catch (error) {
    devError('Error fetching NFT price estimate:', error);
    return 0;
  }
}

/**
 * Get estimated prices for multiple NFTs using the legacy API
 */
export async function getBulkNFTPriceEstimates(nfts: { contract: string, tokenId: string }[]): Promise<Record<string, number>> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/pricing`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ nfts }),
      }
    );

    if (!response.ok) {
      throw new Error(`NFTGo bulk pricing API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data.prices)) {
      return {};
    }

    // Create a map of contract:tokenId -> price
    const priceMap: Record<string, number> = {};

    data.data.prices.forEach((item: any) => {
      if (item.contract && item.tokenId && item.price) {
        const key = `${item.contract}:${item.tokenId}`;
        priceMap[key] = item.price;
      }
    });

    return priceMap;
  } catch (error) {
    console.error('Error fetching bulk NFT price estimates:', error);
    return {};
  }
}

// Track ongoing bulk pricing requests to prevent duplicates
const activeBulkPricingRequests: Map<string, Promise<any>> = new Map();
let lastRequestTime = 0;
const REQUEST_COOLDOWN = 2000; // 2 seconds cooldown between requests
const MAX_BATCH_SIZE = 50; // Maximum number of NFTs to include in a single request

/**
 * Get estimated prices for multiple NFTs using the new bulk pricing API
 * Supports pagination by breaking large requests into smaller batches
 *
 * @param nfts Array of objects with contract_address and token_id
 * @param withWeights Optional boolean to include trait weights in the response
 * @param batchSize Optional batch size (default: 50)
 * @returns Promise with the combined bulk pricing response
 */
export async function getBulkNFTPricing(
  nfts: { contract_address: string, token_id: string }[],
  withWeights: boolean = false,
  batchSize: number = MAX_BATCH_SIZE
): Promise<any> {
  // Ensure batch size doesn't exceed maximum
  const effectiveBatchSize = Math.min(batchSize, MAX_BATCH_SIZE);

  // If the NFT array is empty, return an empty response
  if (!nfts || nfts.length === 0) {
    return { items: [] };
  }

  // If the NFT array is small enough, use a single request
  if (nfts.length <= effectiveBatchSize) {
    return await fetchBulkPricingBatch(nfts, withWeights);
  }

  // For larger arrays, split into batches and combine results
  console.log(`Splitting ${nfts.length} NFTs into batches of ${effectiveBatchSize}`);

  const batches: Array<{ contract_address: string, token_id: string }[]> = [];
  for (let i = 0; i < nfts.length; i += effectiveBatchSize) {
    batches.push(nfts.slice(i, i + effectiveBatchSize));
  }

  console.log(`Created ${batches.length} batches for bulk pricing`);

  // Process batches sequentially to avoid rate limiting issues
  const results = [];
  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1} of ${batches.length}`);
    const batchResult = await fetchBulkPricingBatch(batches[i], withWeights);

    if (batchResult && batchResult.items && Array.isArray(batchResult.items)) {
      results.push(...batchResult.items);
    }

    // Add a delay between batches to avoid rate limiting
    if (i < batches.length - 1) {
      console.log('Adding delay between batches');
      await delay(REQUEST_COOLDOWN);
    }
  }

  // Combine all results into a single response
  return {
    items: results
  };
}

/**
 * Helper function to fetch a single batch of NFT pricing data with retry logic
 *
 * @param nftBatch A batch of NFTs to fetch pricing for
 * @param withWeights Whether to include trait weights
 * @returns Promise with the batch pricing response
 */
async function fetchBulkPricingBatch(
  nftBatch: { contract_address: string, token_id: string }[],
  withWeights: boolean = false
): Promise<any> {
  // Generate a cache key for this batch
  const batchKey = nftBatch.map(nft => `${nft.contract_address}:${nft.token_id}`).join('|');

  // If there's an active request for this batch, return it
  if (activeBulkPricingRequests.has(batchKey)) {
    console.log('Reusing active bulk pricing request for batch');
    return activeBulkPricingRequests.get(batchKey);
  }

  // Check if we need to enforce cooldown
  const now = Date.now();
  if (now - lastRequestTime < REQUEST_COOLDOWN) {
    const waitTime = REQUEST_COOLDOWN - (now - lastRequestTime);
    console.log(`Enforcing cooldown, waiting ${waitTime}ms before making a new request`);
    await delay(waitTime);
  }

  // Update last request time
  lastRequestTime = Date.now();

  // Create a new request
  try {
    console.log(`Fetching bulk pricing for batch of ${nftBatch.length} NFTs`);

    const requestBody = {
      "with_weights": withWeights,
      "params": nftBatch
    };

    // Create the request promise with retry logic
    const requestPromise = (async () => {
      const maxRetries = 2; // Total of 3 attempts (initial + 2 retries)
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Add delay before retry attempts (not on first attempt)
          if (attempt > 0) {
            devLog(`Retrying NFTGo bulk pricing request (attempt ${attempt + 1}/${maxRetries + 1}) after 1 second delay`);
            await delay(1000); // 1 second delay before retry
          }

          const response = await fetch(
            `${API_BASE_URL}/pricing/v1/bulk-pricing`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify(requestBody),
              // Add cache control to prevent browser caching
              cache: 'no-store',
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`NFTGo bulk pricing API error: ${response.status}`);

            // Only retry on 500 errors
            if (response.status === 500 && attempt < maxRetries) {
              devError(`NFTGo bulk pricing API error: ${response.status} (attempt ${attempt + 1}/${maxRetries + 1})`, errorText);
              lastError = error;
              continue; // Try again
            } else {
              // Don't retry for other errors or if we've exhausted retries
              devError(`NFTGo bulk pricing API error: ${response.status}`, errorText);
              throw error;
            }
          }

          const data = await response.json();
          devLog(`Received pricing data for ${data.data?.length || 0} NFTs in batch`);

          return data;
        } catch (error) {
          lastError = error as Error;

          // If this is not a 500 error or we've exhausted retries, throw immediately
          if (attempt === maxRetries || !lastError.message.includes('500')) {
            throw lastError;
          }

          // Continue to next retry attempt for 500 errors
          devError(`Error on attempt ${attempt + 1}/${maxRetries + 1}:`, error);
        }
      }

      // If we get here, all retries failed
      throw lastError || new Error('All retry attempts failed');
    })();

    // Store the promise in the map
    activeBulkPricingRequests.set(batchKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } catch (error) {
      devError('Error fetching bulk NFT pricing batch:', error);
      throw error;
    } finally {
      // Clear the active request after a short delay
      setTimeout(() => {
        activeBulkPricingRequests.delete(batchKey);
      }, 500);
    }
  } catch (error) {
    devError('Error setting up bulk NFT pricing batch request:', error);
    // Clear the active request on setup error
    activeBulkPricingRequests.delete(batchKey);
    throw error;
  }
}

/**
 * Create listings for NFTs on multiple marketplaces
 *
 * @param walletAddress - The wallet address of the maker (seller)
 * @param nfts - Array of NFTs to list with token (contractAddress:tokenId) and price
 * @param marketplaces - Array of marketplaces to list on (e.g., 'opensea', 'blur')
 * @param duration - Duration in days for the listing
 * @returns Promise with the result of the listing creation
 */
export async function createNFTListings(
  walletAddress: string,
  nfts: { token: string, price: string }[],
  marketplaces: string[],
  duration: number = 7 // Default 7 days
): Promise<any> {
  try {
    // Define marketplace configurations with their logos, orderbooks and order kinds
    const marketplaceConfigs = {
      opensea: {
        orderbook: 'opensea',
        order_kind: 'seaport-v1.6',
        logo: 'https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.svg'
      },
      looksrare: {
        orderbook: 'looks-rare',
        order_kind: 'looks-rare-v2',
        logo: 'https://storage.swapspace.co/static/font/src/looks.svg'
      },
      nftgo: {
        orderbook: 'nftgo',
        order_kind: 'seaport-v1.5',
       // order_kind: 'payment-processor-v2',
        logo: 'https://files.readme.io/cdb645a-Vertical.svg'
      }
    };

    // Create params for each NFT and each selected marketplace
    const params = [];

    // For each NFT, create a listing for each selected marketplace
    for (const nft of nfts) {
      // Convert price to wei format (assuming price is in ETH)
      const wei_price = (parseFloat(nft.price) * 1e18).toString();

      // Calculate expiration time in seconds from now
      const expiration_time = Math.floor(Date.now() / 1000 + duration * 24 * 60 * 60).toString();
      const listing_time = Math.floor(Date.now() / 1000).toString();

      // Add a listing parameter for each selected marketplace
      for (const marketplace of marketplaces) {
        // Get the configuration for this marketplace (default to nftgo if not found)
        const config = marketplaceConfigs[marketplace as keyof typeof marketplaceConfigs] || marketplaceConfigs.nftgo;

        params.push({
          token: nft.token,
          wei_price,
          order_kind: config.order_kind,
          orderbook: config.orderbook,
          expiration_time,
          listing_time,
          automated_royalties: config.orderbook === 'opensea' ? true : false,
        });
      }
    }

    // Prepare the request payload exactly as in the example
    const requestPayload = {
      maker: walletAddress,
      params,
    };

    devLog('NFTGo create listings request payload:', JSON.stringify(requestPayload, null, 2));

    // Make the API request to create listings
    const response = await fetch(
      `${API_BASE_URL}/trade/v1/nft/create-listings?chain=ethereum`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      devError(`NFTGo create listings API error: ${response.status} - ${errorText}`);
      throw new Error(`NFTGo create listings API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();

    // Log the full response for debugging
    devLog('NFTGo create listings API response:', JSON.stringify(responseData, null, 2));

    // Return the data part which contains the actions/steps
    if (responseData.code === 'SUCCESS' && responseData.data) {
      // Enhanced logging for transaction data
      if (responseData.data.actions) {
        devLog(`Received ${responseData.data.actions.length} actions from NFTGo API`);

        responseData.data.actions.forEach((action: any, index: number) => {
          devLog(`Action ${index + 1} - Kind: ${action.kind}, Name: ${action.name}`);

          if (action.kind === 'transaction') {
            devLog(`Transaction action details:`, {
              to: action.data?.to,
              hasData: !!action.data?.data,
              dataLength: action.data?.data?.length,
              value: action.data?.value,
              from: action.data?.from
            });
          }
        });
      }

      return responseData.data;
    } else {
      // Throw an error if the API call wasn't successful or data is missing
      const errorMessage = responseData.msg || 'Unknown error from NFTGo create listings API';
      devError('NFTGo create listings API was not successful:', errorMessage, responseData);
      throw new Error(`NFTGo API Error: ${errorMessage}`);
    }
  } catch (error) {
    devError('Error creating NFT listings:', error);
    throw error;
  }
}

/**
 * Cancel NFT listings
 */
/**
 * Check the status of post-order requests with retry logic
 * @param requestIds Array of request IDs to check
 * @param retryCount Number of retries (default: 2)
 * @param initialDelay Initial delay in ms (default: 1000)
 * @returns Promise with the result of the check
 */
export async function checkPostOrderResults(
  requestIds: string[],
  retryCount: number = 2,
  initialDelay: number = 1000
): Promise<any> {
  let currentRetry = 0;
  let currentDelay = initialDelay;

  while (currentRetry <= retryCount) {
    try {
      // Only log on first attempt or retries
      if (currentRetry === 0) {
        console.log('Checking post-order results for request IDs:', requestIds);
      } else {
        console.log(`Retry ${currentRetry}/${retryCount}: Checking post-order results for request IDs:`, requestIds);
      }

      const response = await fetch(
        `${API_BASE_URL}/trade/v1/nft/check-post-order-results?chain=ethereum`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ request_ids: requestIds }),
          // Add cache control to prevent browser caching
          cache: 'no-store',
        }
      );

      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        if (currentRetry < retryCount) {
          currentRetry++;
          console.log(`Rate limit exceeded. Waiting ${currentDelay}ms before retry ${currentRetry}/${retryCount}`);
          await delay(currentDelay);
          // Exponential backoff: double the delay for the next retry
          currentDelay *= 2;
          continue;
        } else {
          throw new Error(`NFTGo API rate limit exceeded after ${retryCount} retries`);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NFTGo check post-order results API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Check post-order results response:', JSON.stringify(data, null, 2));

      // Validate the response structure
      if (!data || data.code !== 'SUCCESS') {
        console.warn('Invalid response format from check post-order results:', data);
        // Return a standardized error response
        return {
          code: 'ERROR',
          msg: 'Invalid response format',
          data: null
        };
      }

      // Check if the response has post_order_results array
      if (data.data && Array.isArray(data.data.post_order_results)) {
        // If the array is empty, it's still processing
        if (data.data.post_order_results.length === 0) {
          console.log('Empty post_order_results array, order is still processing');
        } else {
          // Check for failed orders
          const failedOrders = data.data.post_order_results.filter(
            (result: any) => result.status === 'failed'
          );

          if (failedOrders.length > 0) {
            console.warn('Found failed orders in post_order_results:', failedOrders);
            // We'll let the component handle the failed status
          }

          // Check for successful orders
          const successfulOrders = data.data.post_order_results.filter(
            (result: any) => result.status === 'success'
          );

          if (successfulOrders.length > 0) {
            devLog('Found successful orders in post_order_results:', successfulOrders);
            // We'll let the component handle the success status
          }
        }
      }

      return data;
    } catch (error) {
      // If we've reached the maximum number of retries, or if it's not a retryable error, throw
      if (currentRetry >= retryCount || !(error instanceof Error && error.message.includes('429'))) {
        devError('Error checking post-order results:', error);
        // Return a standardized error response instead of throwing
        return {
          code: 'ERROR',
          msg: error instanceof Error ? error.message : 'Unknown error',
          data: null
        };
      }

      // Increment retry counter and wait before retrying
      currentRetry++;
      devLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying (${currentRetry}/${retryCount}) after ${currentDelay}ms`);
      await delay(currentDelay);
      // Exponential backoff: double the delay for the next retry
      currentDelay *= 2;
    }
  }

  // This should never be reached due to the return in the catch block, but TypeScript requires it
  return {
    code: 'ERROR',
    msg: 'Maximum retries exceeded',
    data: null
  };
}

/**
 * Alias for createNFTListings to ensure compatibility with BulkListingModal component
 */
export const createListings = createNFTListings;

/**
 * Helper function to delay execution
 * @param ms Milliseconds to delay
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get collection statistics from NFTGo
 */
export async function getCollectionStats(): Promise<Omit<MarketplaceComparisonData, 'marketplace'>> {
  try {
    // This would need to be implemented using NFTGo API endpoints
    // Return placeholder data for now
    return {
      floorPrice: 0,
      volume24h: 0,
      listings: 0,
      avgPrice: 0,
    };
  } catch (error) {
    devError('Error getting collection stats via NFTGo:', error);
    return {
      floorPrice: 0,
      volume24h: 0,
      listings: 0,
      avgPrice: 0,
    };
  }
}

/**
 * Get offers for an NFT from NFTGo
 * @param contractAddress The NFT contract address
 * @param tokenId The NFT token ID (optional for collection-wide offers)
 * @param limit Maximum number of offers to return (default: 50)
 * @returns Promise with the offers for the NFT
 */
export async function getOffersForNFT(
  contractAddress: string,
  tokenId?: string,
  limit: number = 50
): Promise<any> {
  try {
    devLog(`Fetching offers for NFT: ${contractAddress}:${tokenId || 'collection-wide'}`);

    // Prepare the request payload
    const requestPayload: any = {
      contract_address: contractAddress,
    };

    // Add token_id if provided (for token-specific offers)
    if (tokenId) {
      requestPayload.token_id = tokenId;
    }

    // Make the API request to get offers
    const response = await fetch(
      `${API_BASE_URL}/orderbook/v1/orders/get-offers-feed-by-nft?chain=ethereum&limit=${limit}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      devError(`NFTGo get offers API error: ${response.status} - ${errorText}`);
      throw new Error(`NFTGo get offers API error: ${response.status}`);
    }

    const data = await response.json();
    devLog(`Found ${data.data?.offers?.length || 0} offers for NFT`);

    return data.data?.offers || [];
  } catch (error) {
    devError('Error fetching offers from NFTGo:', error);
    return [];
  }
}

/**
 * Fulfill (accept) offers for NFTs
 * @param walletAddress The wallet address of the caller (seller)
 * @param orders Array of order IDs or order hashes to fulfill
 * @returns Promise with the result of the fulfill operation
 */
export async function fulfillOffers(
  walletAddress: string,
  orders: string[]
): Promise<any> {
  try {
    // Validate inputs
    if (!walletAddress || !orders || orders.length === 0) {
      throw new Error('Invalid parameters: wallet address and orders are required');
    }

    // Prepare the request payload
    const requestPayload = {
      caller_address: walletAddress,
      orders: orders.map(order => ({ order_id: order }))
    };

    devLog('NFTGo fulfill offers request payload:', JSON.stringify(requestPayload, null, 2));

    // Make the API request to fulfill offers
    const response = await fetch(
      `${API_BASE_URL}/trade/v1/nft/fulfill-offers?chain=ethereum`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      devError(`NFTGo fulfill offers API error: ${response.status} - ${errorText}`);
      throw new Error(`NFTGo fulfill offers API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();

    // Log the full response for debugging
    devLog('NFTGo fulfill offers API response:', JSON.stringify(responseData, null, 2));

    // Return the data part which contains the actions/steps
    if (responseData.code === 'SUCCESS' && responseData.data) {
      // Enhanced logging for transaction data
      if (responseData.data.actions) {
        devLog(`Received ${responseData.data.actions.length} actions from NFTGo API`);

        responseData.data.actions.forEach((action: any, index: number) => {
          devLog(`Action ${index + 1} - Kind: ${action.kind}, Name: ${action.name}`);

          if (action.kind === 'transaction') {
            devLog(`Transaction action details:`, {
              to: action.data?.to,
              hasData: !!action.data?.data,
              dataLength: action.data?.data?.length,
              value: action.data?.value,
              from: action.data?.from
            });
          }
        });
      }

      return responseData.data;
    } else {
      // Throw an error if the API call wasn't successful or data is missing
      const errorMessage = responseData.msg || 'Unknown error from NFTGo fulfill offers API';
      devError('NFTGo fulfill offers API was not successful:', errorMessage, responseData);
      throw new Error(`NFTGo API Error: ${errorMessage}`);
    }
  } catch (error) {
    devError('Error fulfilling offers:', error);
    throw error;
  }
}

// Enhanced cache for getOrdersByMaker results with localStorage persistence
const ordersCache = new Map<string, { data: MarketplaceListing[], timestamp: number }>();
const ORDERS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL (increased for better UX)

// Progressive cache for individual marketplace results
const progressiveCache = new Map<string, { data: MarketplaceListing[], timestamp: number }>();

// Cache utilities for localStorage persistence
const CACHE_STORAGE_KEY = 'nftgo_listings_cache';
const CACHE_VERSION = '1.0';

interface CacheData {
  version: string;
  timestamp: number;
  data: Record<string, { data: MarketplaceListing[], timestamp: number }>;
}

// Load cache from localStorage on module initialization
function loadCacheFromStorage(): void {
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_KEY);
    if (stored) {
      const cacheData: CacheData = JSON.parse(stored);

      // Check cache version and age
      if (cacheData.version === CACHE_VERSION &&
          (Date.now() - cacheData.timestamp) < ORDERS_CACHE_TTL) {

        // Restore cache entries that are still valid
        Object.entries(cacheData.data).forEach(([key, value]) => {
          if ((Date.now() - value.timestamp) < ORDERS_CACHE_TTL) {
            ordersCache.set(key, value);
            console.log(`Restored cached listings for ${key} from localStorage`);
          }
        });
      }
    }
  } catch (error) {
    console.warn('Failed to load cache from localStorage:', error);
  }
}

// Save cache to localStorage
function saveCacheToStorage(): void {
  try {
    const cacheData: CacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data: Object.fromEntries(ordersCache.entries())
    };

    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to save cache to localStorage:', error);
  }
}

// Initialize cache from localStorage
if (typeof window !== 'undefined') {
  loadCacheFromStorage();
}

/**
 * Clear all cached listings data
 * @param walletAddress Optional wallet address to clear cache for specific wallet only
 */
export function clearListingsCache(walletAddress?: string): void {
  if (walletAddress) {
    // Clear cache for specific wallet
    const addressLower = walletAddress.toLowerCase();
    const keysToDelete: string[] = [];

    ordersCache.forEach((_, key) => {
      if (key.startsWith(addressLower)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => ordersCache.delete(key));
    console.log(`Cleared ${keysToDelete.length} cache entries for wallet ${walletAddress}`);
  } else {
    // Clear all cache
    ordersCache.clear();
    console.log('Cleared all listings cache');
  }

  // Update localStorage
  saveCacheToStorage();
}

/**
 * Get orders by maker (listings created by a wallet address) with retry logic and caching
 * @param walletAddress The wallet address of the maker
 * @param orderbook Optional orderbook to filter by (e.g., 'opensea', 'nftgo', 'looksrare')
 * @param retryCount Number of retries (default: 3)
 * @param initialDelay Initial delay in ms (default: 1000)
 * @param forceRefresh Force refresh the cache (default: false)
 * @returns Promise with the listings created by the maker
 */
export async function getOrdersByMaker(
  walletAddress: string,
  orderbook?: string,
  retryCount: number = 3,
  initialDelay: number = 1000,
  forceRefresh: boolean = false
): Promise<MarketplaceListing[]> {
  // Create a cache key based on the wallet address and orderbook
  const cacheKey = `${walletAddress.toLowerCase()}-${orderbook || 'all'}`;

  // Check if we have a cached response and it's still valid
  const cachedResponse = ordersCache.get(cacheKey);
  if (!forceRefresh && cachedResponse && (Date.now() - cachedResponse.timestamp) < ORDERS_CACHE_TTL) {
    console.log(`Using cached orders for maker: ${walletAddress}${orderbook ? ` on ${orderbook}` : ''} (${cachedResponse.data.length} listings)`);
    return cachedResponse.data;
  }

  // Log if we're force refreshing
  if (forceRefresh) {
    console.log(`Force refreshing orders for maker: ${walletAddress}, bypassing cache`);
  }

  let currentRetry = 0;
  let currentDelay = initialDelay;

  while (currentRetry <= retryCount) {
    try {
      // Only log on first attempt or retries
      if (currentRetry === 0) {
        console.log(`Fetching orders by maker ${walletAddress}${orderbook ? ` on ${orderbook}` : ''}`);
      } else {
        console.log(`Retry ${currentRetry}/${retryCount}: Fetching orders by maker ${walletAddress}`);
      }

      const requestBody: any = {
        maker: walletAddress,
        order_type: 'listing',
        include_private: false,
        offset: 0,
        limit: 100,
        forceRefresh: forceRefresh // Pass the forceRefresh parameter to the API
      };

      // Add orderbook if provided to filter by specific marketplace
      if (orderbook) {
        requestBody.orderbook = orderbook;
        console.log(`Filtering orders by orderbook: ${orderbook}`);
      }

      const response = await fetch(
        `${API_BASE_URL}/trade/orderbook/v1/orders/get-orders-by-maker`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(requestBody),
          // Add cache control to prevent browser caching
          cache: 'no-store',
        }
      );

      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        if (currentRetry < retryCount) {
          currentRetry++;
          devLog(`Rate limit exceeded. Waiting ${currentDelay}ms before retry ${currentRetry}/${retryCount}`);
          await delay(currentDelay);
          // Exponential backoff: double the delay for the next retry
          currentDelay *= 2;
          continue;
        } else {
          throw new Error(`NFTGo API rate limit exceeded after ${retryCount} retries`);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NFTGo get orders by maker API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      devLog(`Found ${data.data?.listing_dtos?.length || 0} active listings for maker ${walletAddress}`);

      // Debug: Log the full response structure
      console.log('NFTGo get-orders-by-maker API response structure:', {
        code: data.code,
        msg: data.msg,
        hasData: !!data.data,
        dataKeys: data.data ? Object.keys(data.data) : [],
        listingDtosLength: data.data?.listing_dtos?.length || 0,
        sampleListing: data.data?.listing_dtos?.[0] || null
      });

      // Map the response to our MarketplaceListing format
      if (data.code === 'SUCCESS' && data.data && Array.isArray(data.data.listing_dtos)) {
        const listings = data.data.listing_dtos.map((listing: any) => {
          // Debug: Log each listing structure
          console.log('Processing listing DTO:', {
            order_id: listing.order_id,
            contract_address: listing.contract_address,
            token_id: listing.token_id,
            market_id: listing.market_id,
            status: listing.status,
            price: listing.price
          });

          // Normalize marketplace IDs to match our UI expectations
          let marketplace = listing.market_id;
          const orderbook = listing.orderbook || listing.market_id;

          // Map market_id to our expected marketplace IDs
          if (listing.market_id === 'seaport') {
            marketplace = 'opensea';
          } else if (listing.market_id === 'looks-rare') {
            marketplace = 'looksrare';
          } else if (listing.market_id === 'payment-processor') {
            marketplace = 'nftgo';
          }

          // Log detailed marketplace mapping information
          console.log(`Mapping marketplace for NFT ${listing.contract_address}:${listing.token_id}:`);
          console.log(`  - Original market_id: ${listing.market_id}`);
          console.log(`  - Orderbook: ${orderbook}`);
          console.log(`  - Normalized marketplace: ${marketplace}`);

          const mappedListing = {
            id: listing.order_id,
            orderHash: listing.order_hash,
            contractAddress: listing.contract_address,
            tokenId: listing.token_id,
            price: listing.price?.amount?.decimal || 0,
            priceUsd: listing.price?.amount?.usd || 0,
            currency: listing.price?.currency?.symbol || 'ETH',
            marketplace: marketplace,
            originalMarketplace: listing.market_id, // Keep the original for reference
            maker: listing.maker,
            status: listing.status,
            createdAt: new Date(listing.order_create_time),
            expiresAt: (() => {
              if (!listing.order_expiration_time) return null;
              try {
                // Handle both seconds and milliseconds timestamps
                const timestamp = typeof listing.order_expiration_time === 'number'
                  ? listing.order_expiration_time
                  : parseInt(listing.order_expiration_time);

                // If timestamp is too large (> year 3000), it's likely in milliseconds
                const date = new Date(timestamp > 32503680000 ? timestamp : timestamp * 1000);

                // Validate the date
                if (isNaN(date.getTime())) {
                  console.warn(`Invalid expiration timestamp for listing ${listing.order_id}:`, listing.order_expiration_time);
                  return null;
                }

                return date;
              } catch (error) {
                console.error(`Error parsing expiration time for listing ${listing.order_id}:`, error, listing.order_expiration_time);
                return null;
              }
            })(),
            expiration: listing.order_expiration_time || undefined, // Keep the raw timestamp for backward compatibility
            kind: listing.kind,
            feeBps: listing.fee_bps || 0,
            feeBreakdown: listing.fee_breakdown || []
          };

          console.log('Mapped listing:', mappedListing);
          return mappedListing;
        });

        // Store the results in the cache
        ordersCache.set(cacheKey, { data: listings, timestamp: Date.now() });

        // Save to localStorage for persistence
        saveCacheToStorage();

        return listings;
      } else {
        // Log unexpected response structure
        console.warn('Unexpected NFTGo API response structure:', {
          code: data.code,
          hasData: !!data.data,
          dataType: typeof data.data,
          dataKeys: data.data ? Object.keys(data.data) : [],
          isListingDtosArray: Array.isArray(data.data?.listing_dtos)
        });
      }

      // Store empty results in the cache to prevent repeated calls for the same data
      ordersCache.set(cacheKey, { data: [], timestamp: Date.now() });

      // Save to localStorage for persistence
      saveCacheToStorage();

      return [];
    } catch (error) {
      // If we've reached the maximum number of retries, or if it's not a retryable error, throw
      if (currentRetry >= retryCount || !(error instanceof Error && error.message.includes('429'))) {
        console.error('Error fetching orders by maker:', error);
        return [];
      }

      // Increment retry counter and wait before retrying
      currentRetry++;
      console.log(`Error: ${error.message}. Retrying (${currentRetry}/${retryCount}) after ${currentDelay}ms`);
      await delay(currentDelay);
      // Exponential backoff: double the delay for the next retry
      currentDelay *= 2;
    }
  }

  // This should never be reached due to the return in the catch block, but TypeScript requires it
  return [];
}

/**
 * Progressive callback for getAllOrdersByMakerProgressive
 */
export type ProgressiveCallback = (
  marketplace: string,
  listings: MarketplaceListing[],
  isComplete: boolean,
  allListings: MarketplaceListing[]
) => void;

/**
 * Get orders by maker from all supported marketplaces with progressive updates
 * This function calls the API for each orderbook separately and provides incremental updates
 * @param walletAddress The wallet address of the maker
 * @param onProgress Callback function called after each marketplace completes
 * @param retryCount Number of retries (default: 3)
 * @param initialDelay Initial delay in ms (default: 1000)
 * @param forceRefresh Force refresh the cache (default: false)
 * @returns Promise with all listings from all marketplaces
 */
export async function getAllOrdersByMakerProgressive(
  walletAddress: string,
  onProgress: ProgressiveCallback,
  retryCount: number = 3,
  initialDelay: number = 1000,
  forceRefresh: boolean = false
): Promise<MarketplaceListing[]> {
  console.log(`Fetching orders progressively from all marketplaces for maker: ${walletAddress}`);

  // Define the supported orderbooks (using the correct NFTGo API parameter names)
  const orderbooks = ['opensea', 'looks-rare', 'nftgo'];
  const allListings: MarketplaceListing[] = [];

  // Check if we have any cached data to show immediately
  if (!forceRefresh) {
    const cachedListings: MarketplaceListing[] = [];
    let hasCachedData = false;

    for (const orderbook of orderbooks) {
      const cacheKey = `${walletAddress.toLowerCase()}-${orderbook}`;
      const cachedResponse = ordersCache.get(cacheKey);

      if (cachedResponse && (Date.now() - cachedResponse.timestamp) < ORDERS_CACHE_TTL) {
        console.log(`Found cached data for ${orderbook}: ${cachedResponse.data.length} listings`);
        cachedListings.push(...cachedResponse.data);
        hasCachedData = true;
      }
    }

    // If we have cached data, show it immediately
    if (hasCachedData) {
      const uniqueCachedListings = cachedListings.filter((listing, index, self) =>
        index === self.findIndex(l => l.id === listing.id)
      );
      console.log(`Showing ${uniqueCachedListings.length} cached listings immediately`);
      onProgress('cache', uniqueCachedListings, false, uniqueCachedListings);
      allListings.push(...uniqueCachedListings);
    }
  }

  // Fetch fresh data from each marketplace
  for (let i = 0; i < orderbooks.length; i++) {
    const orderbook = orderbooks[i];
    const isLastMarketplace = i === orderbooks.length - 1;

    try {
      console.log(`Fetching fresh listings from ${orderbook}...`);
      const listings = await getOrdersByMaker(walletAddress, orderbook, retryCount, initialDelay, forceRefresh);
      console.log(`Found ${listings.length} fresh listings from ${orderbook}`);

      // Update allListings with fresh data, removing old cached data for this marketplace
      const otherMarketplaceListings = allListings.filter(listing => listing.marketplace !== orderbook);
      const updatedAllListings = [...otherMarketplaceListings, ...listings];

      // Remove duplicates
      const uniqueListings = updatedAllListings.filter((listing, index, self) =>
        index === self.findIndex(l => l.id === listing.id)
      );

      // Update the main array
      allListings.length = 0;
      allListings.push(...uniqueListings);

      // Call progress callback
      onProgress(orderbook, listings, isLastMarketplace, uniqueListings);

      // Add delay between requests to avoid rate limiting (except for the last one)
      if (!isLastMarketplace) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
    } catch (error) {
      console.error(`Error fetching listings from ${orderbook}:`, error);
      // Call progress callback with empty listings for this marketplace
      onProgress(orderbook, [], isLastMarketplace, allListings);
    }
  }

  console.log(`Progressive fetch complete: ${allListings.length} total unique listings`);
  return allListings;
}

/**
 * Get orders by maker from all supported marketplaces (non-progressive version)
 * This function calls the API for each orderbook separately to ensure we get all listings
 * @param walletAddress The wallet address of the maker
 * @param retryCount Number of retries (default: 3)
 * @param initialDelay Initial delay in ms (default: 1000)
 * @param forceRefresh Force refresh the cache (default: false)
 * @returns Promise with all listings from all marketplaces
 */
export async function getAllOrdersByMaker(
  walletAddress: string,
  retryCount: number = 3,
  initialDelay: number = 1000,
  forceRefresh: boolean = false
): Promise<MarketplaceListing[]> {
  console.log(`Fetching orders from all marketplaces for maker: ${walletAddress}`);

  // Define the supported orderbooks (using the correct NFTGo API parameter names)
  const orderbooks = ['opensea', 'looks-rare', 'nftgo'];

  // Fetch listings from each marketplace separately with delay to avoid rate limiting
  const allListings: MarketplaceListing[] = [];

  for (const orderbook of orderbooks) {
    try {
      console.log(`Fetching listings from ${orderbook}...`);
      const listings = await getOrdersByMaker(walletAddress, orderbook, retryCount, initialDelay, forceRefresh);
      console.log(`Found ${listings.length} listings from ${orderbook}`);
      allListings.push(...listings);

      // Add a small delay between requests to avoid rate limiting
      if (orderbook !== orderbooks[orderbooks.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
    } catch (error) {
      console.error(`Error fetching listings from ${orderbook}:`, error);
      // Continue with other marketplaces even if one fails
    }
  }

  // Remove duplicates by order ID (in case an NFT is listed on multiple marketplaces with the same order ID)
  const uniqueListings = allListings.filter((listing, index, self) =>
    index === self.findIndex(l => l.id === listing.id)
  );

  console.log(`Total unique listings found: ${uniqueListings.length} (from ${allListings.length} total)`);

  return uniqueListings;
}

/**
 * Cancel NFT listings
 * @param walletAddress The wallet address of the maker
 * @param orderIds Array of order IDs to cancel
 * @returns Promise with the result of the cancellation
 */
export async function cancelNFTListings(
  walletAddress: string,
  orderIds: string[]
): Promise<any> {
  try {
    console.log('Canceling NFT listings with order IDs:', orderIds);

    // Validate order IDs and ensure they're in the correct format
    const validOrderIds = orderIds.filter(id => {
      // Basic validation to ensure we have a non-empty string
      if (!id || typeof id !== 'string') {
        console.warn(`Invalid order ID: ${id}, skipping`);
        return false;
      }
      return true;
    });

    if (validOrderIds.length === 0) {
      throw new Error('No valid order IDs to cancel');
    }

    // Prepare the request payload with order_hash as a fallback
    // NFTGo API can use either order_id or order_hash for cancellation
    const requestPayload = {
      caller_address: walletAddress,
      orders: validOrderIds.map(orderId => {
        // Check if the ID looks like a hash (longer string) or a regular ID
        const isHash = orderId.length > 24;
        return {
          [isHash ? 'order_hash' : 'order_id']: orderId,
          order_type: 'listing'
        };
      })
    };

    devLog('Cancel orders request payload:', JSON.stringify(requestPayload, null, 2));

    // Updated endpoint to match NFTGo API structure
    const response = await fetch(
      `${API_BASE_URL}/trade/v1/nft/cancel-orders?chain=ethereum`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NFTGo cancel listings API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Cancel orders response:', JSON.stringify(data, null, 2));

    // Clear the orders cache for this wallet to ensure fresh data after cancellation
    const cacheKey = `${walletAddress.toLowerCase()}-all`;
    ordersCache.delete(cacheKey);

    return data;
  } catch (error) {
    console.error('Error canceling NFT listings:', error);
    throw error;
  }
}

/**
 * Get more NFTs using cursor pagination
 * This function can be used to implement "load more" functionality
 */
export async function getMoreNFTsWithCursor(
  walletAddress: string,
  cursor: string
): Promise<{ nfts: NFT[], nextCursor: string | null }> {
  try {
    console.log('Fetching more NFTs from NFTGo with cursor:', cursor);

    // Call our proxy API route with cursor for pagination
    const response = await fetch(
      `${API_BASE_URL}/nfts?address=${walletAddress}&limit=20&sort_by=receivedTime&asc=false&cursor=${cursor}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NFTGo API error response:', errorText);
      throw new Error(`NFTGo API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.nfts?.length || 0} more NFTs with cursor`);

    if (!data || !Array.isArray(data.nfts)) {
      return { nfts: [], nextCursor: null };
    }

    // Map NFTGo API response to our NFT format
    const mappedNFTs = data.nfts.map((nft: any) => {
      // Extract image URL
      let imageUrl = nft.image || '';

      // Use animation_url as fallback if available
      if ((!imageUrl || !isValidUrl(imageUrl)) && nft.animation_url) {
        imageUrl = nft.animation_url;
      }

      // Validate image URL
      if (!isValidUrl(imageUrl)) {
        imageUrl = DEFAULT_NFT_IMAGE;
      }

      // Map traits to attributes format - create a fresh copy for each NFT
      const attributes = Array.isArray(nft.traits)
        ? nft.traits.map((trait: any) => {
            // Create a completely new object for each trait to avoid reference issues
            return {
              trait_type: trait.type || '',
              value: trait.value || '',
              // Include rarity percentage if available
              ...(trait.percentage !== undefined && { rarity_percentage: trait.percentage })
            };
          })
        : [];

      return {
        id: `${nft.contract_address}:${nft.token_id}`,
        name: nft.name || `#${nft.token_id}`,
        description: nft.description || '',
        image: imageUrl,
        tokenId: nft.token_id,
        contractAddress: nft.contract_address,
        owner: walletAddress,
        collection: {
          name: nft.collection_name || 'Unknown Collection',
          // Use collection slug for potential image lookup
          slug: nft.collection_slug || '',
          opensea_slug: nft.collection_opensea_slug || ''
        },
        metadata: {
          contract_type: nft.contract_type,
          blockchain: nft.blockchain,
          animation_url: nft.animation_url,
          // Include rarity data if available
          rarity: nft.rarity || {}
        },
        // Include last sale data if available
        lastPrice: nft.last_sale?.price || 0,
        currency: nft.last_sale?.currency || 'ETH',
        // Create a deep copy of attributes to ensure each NFT has its own array
        attributes: JSON.parse(JSON.stringify(attributes)),
        // Check if NFT is suspicious/spam
        isSpam: nft.rarity?.suspicious || false
      };
    }).filter((nft: NFT) => !nft.isSpam); // Filter out spam NFTs

    return {
      nfts: mappedNFTs,
      nextCursor: data.next_cursor || null
    };
  } catch (error) {
    console.error('Error fetching more NFTs with cursor:', error);
    return { nfts: [], nextCursor: null };
  }
}
