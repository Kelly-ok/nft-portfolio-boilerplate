import { NFT, MarketplaceComparisonData } from '@/types';

// Define interface for Moralis API NFT response based on the provided example
interface MoralisNFTResult {
  amount: string;
  token_id: string;
  token_address: string;
  contract_type: string;
  owner_of: string;
  last_metadata_sync: string;
  last_token_uri_sync: string;
  metadata: string | null;
  block_number: string;
  block_number_minted: string | null;
  name: string;
  symbol: string;
  token_hash: string;
  token_uri: string;
  minter_address: string | null;
  verified_collection: boolean;
  possible_spam: boolean;
  last_sale: {
    price: number;
    price_currency: string;
    price_usd: number;
    marketplace: string;
  } | null;
  normalized_metadata: {
    name: string | null;
    description: string | null;
    animation_url: string | null;
    external_link: string | null;
    image: string | null;
    attributes: Array<{
      trait_type: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: any;
      display_type: string | null;
      max_value: number | null;
      trait_count: number;
      order: number | null;
      rarity_label: string | null;
      count: number | null;
      percentage: number | null;
    }>;
  };
  collection_logo: string | null;
  collection_banner_image: string | null;
  collection_category: string | null;
  project_url: string | null;
  wiki_url: string | null;
  discord_url: string | null;
  twitter_username: string | null;
  instagram_username: string | null;
  list_price: {
    listed: boolean;
    price: number | null;
    price_currency: string | null;
    price_usd: number | null;
    marketplace: string | null;
  };
  floor_price: number | null;
  floor_price_usd: number | null;
  floor_price_currency: string | null;
}

interface MoralisNFTResponse {
  status: string;
  page: number;
  page_size: number;
  cursor: string | null;
  result: MoralisNFTResult[];
}

// Use our server-side API route instead of direct Moralis API
const API_BASE_URL = '/api/moralis';

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
  } catch (e) {
    return false;
  }
}

/**
 * Get NFTs owned by a wallet address from Moralis
 */
export async function getNFTsByWalletMoralis(walletAddress: string, chainId: number | undefined): Promise<NFT[]> {

  try {
    // Call our server-side API route to get NFTs for the wallet
    const response = await fetch(
      `${API_BASE_URL}/nfts?address=${walletAddress}&chainId=${chainId}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }

    const data = await response.json() as MoralisNFTResponse;

    // Transform the Moralis response to our NFT type
    return data.result.map((item: MoralisNFTResult) => {
      // Parse metadata if it's a string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsedMetadata: Record<string, any> = {};
      if (typeof item.metadata === 'string' && item.metadata) {
        try {
          parsedMetadata = JSON.parse(item.metadata);
        } catch (e) {
          console.error('Error parsing NFT metadata:', e);
        }
      }

      // Use normalized metadata for image if available
      // Fall back to collection_logo if other image sources are empty/not found
      let imageUrl = item.normalized_metadata?.image ||
        parsedMetadata?.image_url ||
        parsedMetadata?.image ||
        item.collection_logo ||
        '';

      // Convert IPFS URLs to HTTPS format
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }

      // If the image URL is empty or invalid, use the placeholder image
      if (!imageUrl || !isValidUrl(imageUrl)) {
        imageUrl = DEFAULT_NFT_IMAGE;
      }

      // Extract attributes from normalized metadata or parsed metadata
      const rawAttributes = item.normalized_metadata?.attributes || parsedMetadata?.attributes || [];

      // Log the attributes for debugging
      console.log(`Moralis NFT ${item.token_id} attributes:`, rawAttributes);

      // Convert attributes to the format expected by our NFT type
      // Create a completely new array of attributes for each NFT
      const formattedAttributes = Array.isArray(rawAttributes)
        ? rawAttributes.map(attr => {
            // Create a completely new object for each trait to avoid reference issues
            return {
              trait_type: attr.trait_type || '',
              value: String(attr.value || ''), // Convert to string to match our type
              display_type: attr.display_type || undefined, // Convert null to undefined
              max_value: attr.max_value || undefined, // Convert null to undefined
              rarity_percentage: attr.percentage || undefined // Use percentage as rarity_percentage
            };
          })
        : [];

      return {
        id: `${item.token_address}-${item.token_id}`,
        name: item.normalized_metadata?.name || parsedMetadata?.name || `${item.name} #${item.token_id}`,
        description: item.normalized_metadata?.description || parsedMetadata?.description || '',
        image: imageUrl,
        tokenId: item.token_id,
        contractAddress: item.token_address,
        owner: item.owner_of,
        collection: {
          name: item.name || 'Unknown Collection',
          image: item.collection_logo || undefined,
        },
        // Store formatted attributes that match our NFT type - create a deep copy
        attributes: JSON.parse(JSON.stringify(formattedAttributes)),
        // Store the full metadata object for access to all data
        metadata: {
          normalized_metadata: item.normalized_metadata || {},
          possible_spam: item.possible_spam, // Include the possible_spam field from Moralis
          ...parsedMetadata
        },
        lastPrice: (item.last_sale?.price || item.list_price?.price) ? {
          payment_token: {
            address: '0x0000000000000000000000000000000000000000',
            symbol: item.last_sale?.price_currency || item.list_price?.price_currency || 'ETH',
            decimals: 18
          },
          raw_value: String(Math.floor((item.last_sale?.price || item.list_price?.price || 0) * 1e18)),
          usd: (item.last_sale?.price || item.list_price?.price || 0) * 3000, // Approximate ETH to USD conversion
          value: item.last_sale?.price || item.list_price?.price || 0
        } : undefined,
      };
    });
  } catch (error) {
    console.error('Error fetching NFTs from Moralis:', error);
    return [];
  }
}


/**
 * Get collection statistics (placeholder - would need to be implemented with specific Moralis endpoints)
 */
/**
 * Check if NFTs from wallet are listed on marketplaces
 */
export function checkNFTListings(nfts: NFT[], listings: any[]): NFT[] {
  return nfts.map(nft => {
    const isListed = listings.some(listing =>
      listing.contract.toLowerCase() === nft.contractAddress.toLowerCase() &&
      listing.criteria?.data?.token?.tokenId === nft.tokenId &&
      listing.status === 'active'
    );
    return {
      ...nft,
      isListed
    };
  });
}

export async function getCollectionStats(): Promise<Omit<MarketplaceComparisonData, 'marketplace'>> {
  try {
    // Moralis doesn't have a direct endpoint for collection stats in the same way
    // This would need to be implemented using other Moralis endpoints or services

    // Return placeholder data
    return {
      floorPrice: 0,
      volume24h: 0,
      listings: 0,
      avgPrice: 0,
    };
  } catch (error) {
    console.error('Error getting collection stats via Moralis:', error);
    return {
      floorPrice: 0,
      volume24h: 0,
      listings: 0,
      avgPrice: 0,
    };
  }
}