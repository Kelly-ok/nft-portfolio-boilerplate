import { NFT, MarketplaceName, MarketplaceComparisonData } from '@/types';
import { MOCK_ENABLED } from '@/lib/constants';
import { devLog, devWarn, devError } from '@/lib/dev-utils';

// Import individual marketplace services
import * as Moralis from './moralis';
import * as NFTGo from './nftgo';

// Map of marketplace services
const marketplaceServices = {
  moralis: Moralis,
  nftgo: NFTGo,
};


/**
 * Helper function to normalize token IDs for consistent comparison
 * Handles different formats that might come from different APIs
 */
function normalizeTokenId(tokenId: string): string {
  // If it's a valid number, convert to BigInt string representation
  if (!isNaN(Number(tokenId))) {
    try {
      return BigInt(tokenId).toString();
    } catch (e) {
      // If BigInt conversion fails (e.g., for very large numbers), return as is
      console.warn(`Failed to normalize token ID: ${tokenId}`, e);
    }
  }
  return tokenId;
}

/**
 * Get NFTs owned by a wallet address using NFTGo API (Ethereum only)
 * Also compares with Moralis to exclude spam NFTs and enhance metadata
 */
export async function getNFTsByWallet(walletAddress: string, chainid: number | undefined): Promise<NFT[]> {
  if (MOCK_ENABLED) {
    return getMockNFTs(walletAddress);
  }

  try {
    devLog('Fetching NFTs for wallet:', walletAddress, 'chainId:', chainid);

    // Only support Ethereum (chainId = 1)
    if (chainid !== 1 && chainid !== undefined) {
      devWarn('NFTGo API only supports Ethereum network. Returning empty array for other networks.');
      return [];
    }

    // Use NFTGo as the primary source for NFT data
    const nftgoNFTs = await NFTGo.getNFTsByWalletNFTGo(walletAddress);
    devLog(`Found ${nftgoNFTs.length} NFTs from NFTGo API`);

    // Detailed log of NFTs from NFTGo
    devLog('NFTGo NFTs:', nftgoNFTs.map(nft => ({
      id: nft.id,
      name: nft.name,
      contractAddress: nft.contractAddress,
      tokenId: nft.tokenId,
      attributes: nft.attributes
    })));

    if (nftgoNFTs.length === 0) {
      // If NFTGo returns no NFTs, try Moralis as a fallback
      devLog('No NFTs found with NFTGo, trying Moralis as fallback');
      return await Moralis.getNFTsByWalletMoralis(walletAddress, chainid);
    }

    // Fetch NFTs from Moralis for comparison and to enhance metadata
    try {
      devLog('Fetching NFTs from Moralis for comparison and metadata enhancement');
      const moralisNFTs = await Moralis.getNFTsByWalletMoralis(walletAddress, chainid);
      devLog(`Found ${moralisNFTs.length} NFTs from Moralis API`);

      // Detailed log of NFTs from Moralis
      devLog('Moralis NFTs:', moralisNFTs.map(nft => ({
        id: nft.id,
        name: nft.name,
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenId,
        attributes: nft.attributes,
        metadata: nft.metadata
      })));

      if (moralisNFTs.length === 0) {
        // If Moralis returns no NFTs, just use NFTGo data
        devLog('No NFTs found with Moralis, using NFTGo data only');
        return nftgoNFTs;
      }

      // Create a map of Moralis NFTs by contract address and token ID for easy lookup
      // Moralis returns token_id and token_address in its raw response
      const moralisNFTMap = new Map<string, NFT>();
      moralisNFTs.forEach(nft => {
        // Ensure consistent format for comparison
        // Normalize the token ID and contract address to lowercase for consistent comparison
        const contractAddress = nft.contractAddress.toLowerCase();
        const normalizedTokenId = normalizeTokenId(nft.tokenId);

        // Create a normalized key for consistent lookup
        const key = `${contractAddress}:${normalizedTokenId}`;
        moralisNFTMap.set(key, nft);

        // Also store with original token ID as a fallback
        if (normalizedTokenId !== nft.tokenId) {
          const originalKey = `${contractAddress}:${nft.tokenId}`;
          moralisNFTMap.set(originalKey, nft);
        }
      });

      devLog(`Created lookup map with ${moralisNFTMap.size} Moralis NFT entries`);

      // Compare NFTs from NFTGo that are missing from Moralis
      const missingFromMoralis = nftgoNFTs.filter(nftgoNFT => {
        const contractAddress = nftgoNFT.contractAddress.toLowerCase();
        const normalizedTokenId = normalizeTokenId(nftgoNFT.tokenId);

        // Create a normalized key for consistent lookup
        const normalizedKey = `${contractAddress}:${normalizedTokenId}`;

        // Try with normalized key first
        let exists = moralisNFTMap.has(normalizedKey);

        // If not found, try with original token ID as fallback
        if (!exists && normalizedTokenId !== nftgoNFT.tokenId) {
          const originalKey = `${contractAddress}:${nftgoNFT.tokenId}`;
          exists = moralisNFTMap.has(originalKey);
        }

        return !exists;
      });

      devLog(`Found ${missingFromMoralis.length} NFTs from NFTGo that are missing in Moralis (will be kept as requested):`,
        missingFromMoralis.map(nft => ({
          id: nft.id,
          name: nft.name,
          contractAddress: nft.contractAddress,
          tokenId: nft.tokenId,
          isSpam: nft.isSpam
        }))
      );

      // Filter and enhance NFTGo NFTs based on Moralis data
      const enhancedNFTs = nftgoNFTs
        .filter(nftgoNFT => {
          // Create a key for lookup in the Moralis map
          // Ensure consistent format for comparison with Moralis data
          const contractAddress = nftgoNFT.contractAddress.toLowerCase();
          const normalizedTokenId = normalizeTokenId(nftgoNFT.tokenId);

          // Create a normalized key for consistent lookup
          const normalizedKey = `${contractAddress}:${normalizedTokenId}`;

          // Try to find the NFT in Moralis data using the normalized key format
          let moralisNFT = moralisNFTMap.get(normalizedKey);

          // If not found, try with the original token ID as fallback
          if (!moralisNFT && normalizedTokenId !== nftgoNFT.tokenId) {
            const originalKey = `${contractAddress}:${nftgoNFT.tokenId}`;
            moralisNFT = moralisNFTMap.get(originalKey);

            if (moralisNFT) {
              devLog(`Found NFT match using original token ID format: ${originalKey}`);
            }
          }

          // If the NFT doesn't exist in Moralis data, keep it (don't filter out)
          if (!moralisNFT) {
            devLog(`NFT ${normalizedKey} not found in Moralis data, but keeping it as requested`);
            return true;
          }

          // Check if the NFT is marked as spam in Moralis
          if (moralisNFT.metadata &&
              typeof moralisNFT.metadata === 'object' &&
              moralisNFT.metadata.possible_spam === true) {
            devLog(`Filtering out NFT ${normalizedKey} as it's marked as spam in Moralis (possible_spam: ${moralisNFT.metadata.possible_spam})`);
            return false;
          }

          // Log for debugging
          devLog(`NFT ${normalizedKey} passed spam check (possible_spam: ${moralisNFT.metadata?.possible_spam})`);

          // Keep the NFT if it exists in Moralis and is not marked as spam,
          // or if it doesn't exist in Moralis at all
          return true;
        })
        .map(nftgoNFT => {
          // Create a key for lookup in the Moralis map
          const contractAddress = nftgoNFT.contractAddress.toLowerCase();
          const normalizedTokenId = normalizeTokenId(nftgoNFT.tokenId);

          // Create a normalized key for consistent lookup
          const normalizedKey = `${contractAddress}:${normalizedTokenId}`;

          // Try to find the corresponding Moralis NFT with normalized key
          let moralisNFT = moralisNFTMap.get(normalizedKey);

          // If not found with normalized key, try with original token ID
          if (!moralisNFT && normalizedTokenId !== nftgoNFT.tokenId) {
            const originalKey = `${contractAddress}:${nftgoNFT.tokenId}`;
            moralisNFT = moralisNFTMap.get(originalKey);
          }

          // moralisNFT might not exist if the NFT is only in NFTGo but not in Moralis
          // Only enhance with Moralis data if the NFT exists in Moralis

          if (moralisNFT) {
            // Debug: Log the NFT data before merging
            devLog(`DEBUG - Merging data for NFT ${normalizedKey}`);
            devLog('NFTGo NFT attributes before merge:', nftgoNFT.attributes);
            devLog('Moralis NFT attributes:', moralisNFT.attributes);
            devLog('Moralis NFT metadata:', moralisNFT.metadata);

            // Check if Moralis has normalized_metadata.attributes
            const hasMoralisNormalizedAttributes = moralisNFT.metadata &&
                                                typeof moralisNFT.metadata === 'object' &&
                                                moralisNFT.metadata.normalized_metadata &&
                                                moralisNFT.metadata.normalized_metadata.attributes &&
                                                moralisNFT.metadata.normalized_metadata.attributes.length > 0;

            // Check if Moralis has direct attributes in metadata
            const hasMoralisMetadataAttributes = moralisNFT.metadata &&
                                              typeof moralisNFT.metadata === 'object' &&
                                              moralisNFT.metadata.attributes &&
                                              Array.isArray(moralisNFT.metadata.attributes) &&
                                              moralisNFT.metadata.attributes.length > 0;

            devLog('Has Moralis direct attributes:', moralisNFT.attributes && moralisNFT.attributes.length > 0);
            devLog('Has Moralis normalized attributes:', hasMoralisNormalizedAttributes);
            devLog('Has Moralis metadata attributes:', hasMoralisMetadataAttributes);

            // Merge attributes from Moralis if not present in NFTGo or if NFTGo attributes are empty
            if ((!nftgoNFT.attributes || nftgoNFT.attributes.length === 0)) {
              // First check standard attributes array
              if (moralisNFT.attributes && Array.isArray(moralisNFT.attributes) && moralisNFT.attributes.length > 0) {
                devLog(`Enhancing NFT ${normalizedKey} with attributes from Moralis`);
                // Create a completely new array of attributes for this specific NFT
                nftgoNFT.attributes = moralisNFT.attributes.map(attr => ({
                  trait_type: attr.trait_type || '',
                  value: attr.value || '',
                  display_type: attr.display_type,
                  max_value: attr.max_value,
                  rarity_percentage: attr.rarity_percentage
                }));
                devLog('NFTGo NFT attributes after merge with direct attributes:', nftgoNFT.attributes);
              }
              // If no attributes found but Moralis has metadata with normalized_metadata.attributes
              else if (hasMoralisNormalizedAttributes && moralisNFT.metadata) {
                devLog(`Enhancing NFT ${normalizedKey} with attributes from Moralis normalized_metadata`);
                // Ensure we're using the correct format for attributes
                const normalizedAttributes = moralisNFT.metadata.normalized_metadata.attributes.map((attr: any) => ({
                  trait_type: attr.trait_type || '',
                  value: String(attr.value || ''),
                  display_type: attr.display_type || undefined,
                  max_value: attr.max_value || undefined,
                  rarity_percentage: attr.percentage || undefined
                }));
                // Create a completely new array of attributes for this specific NFT
                nftgoNFT.attributes = normalizedAttributes.map((attr: any) => ({
                  trait_type: attr.trait_type || '',
                  value: attr.value || '',
                  display_type: attr.display_type,
                  max_value: attr.max_value,
                  rarity_percentage: attr.rarity_percentage
                }));
                devLog('NFTGo NFT attributes after merge with normalized attributes:', nftgoNFT.attributes);
              }
              // If no attributes found but Moralis has metadata.attributes
              else if (hasMoralisMetadataAttributes && moralisNFT.metadata) {
                devLog(`Enhancing NFT ${normalizedKey} with attributes from Moralis metadata.attributes`);
                // Ensure we're using the correct format for attributes
                const metadataAttributes = moralisNFT.metadata.attributes.map((attr: any) => ({
                  trait_type: attr.trait_type || '',
                  value: String(attr.value || ''),
                  display_type: attr.display_type || undefined,
                  max_value: attr.max_value || undefined,
                  rarity_percentage: attr.percentage || undefined
                }));
                // Create a completely new array of attributes for this specific NFT
                nftgoNFT.attributes = metadataAttributes.map((attr: any) => ({
                  trait_type: attr.trait_type || '',
                  value: attr.value || '',
                  display_type: attr.display_type,
                  max_value: attr.max_value,
                  rarity_percentage: attr.rarity_percentage
                }));
                devLog('NFTGo NFT attributes after merge with metadata attributes:', nftgoNFT.attributes);
              }
            }

            // Store the full Moralis metadata in the NFT object for access to all trait data
            if (!nftgoNFT.metadata || typeof nftgoNFT.metadata !== 'object') {
              nftgoNFT.metadata = {};
            }

            // Add Moralis normalized_metadata to the NFT metadata if available
            if (moralisNFT.metadata && typeof moralisNFT.metadata === 'object') {
              devLog(`Adding Moralis metadata to NFT ${normalizedKey}`);

              // Create a deep copy of the metadata to avoid reference issues
              const mergedMetadata = {
                ...JSON.parse(JSON.stringify(nftgoNFT.metadata || {})),
                ...JSON.parse(JSON.stringify(moralisNFT.metadata))
              };

              // Store the full Moralis metadata
              nftgoNFT.metadata = mergedMetadata;

              // If Moralis has normalized_metadata, make sure it's directly accessible
              if (moralisNFT.metadata.normalized_metadata && nftgoNFT.metadata) {
                // Create a deep copy of normalized_metadata
                nftgoNFT.metadata.normalized_metadata = JSON.parse(
                  JSON.stringify(moralisNFT.metadata.normalized_metadata)
                );

                // Log the normalized metadata attributes for debugging
                if (moralisNFT.metadata.normalized_metadata.attributes) {
                  devLog(`NFT ${normalizedKey} has normalized_metadata.attributes:`,
                    moralisNFT.metadata.normalized_metadata.attributes.length);
                }
              }
            }

            // If NFTGo has no description but Moralis does, use Moralis description
            if ((!nftgoNFT.description || nftgoNFT.description === '')) {
              // Try standard description first
              if (moralisNFT.description && moralisNFT.description !== '') {
                devLog(`Adding missing description for NFT ${normalizedKey} from Moralis`);
                nftgoNFT.description = moralisNFT.description;
              }
              // Try normalized_metadata description if available
              else if (moralisNFT.metadata &&
                      typeof moralisNFT.metadata === 'object' &&
                      moralisNFT.metadata.normalized_metadata &&
                      moralisNFT.metadata.normalized_metadata.description) {
                devLog(`Adding missing description for NFT ${normalizedKey} from Moralis normalized_metadata`);
                nftgoNFT.description = moralisNFT.metadata.normalized_metadata.description;
              }
            }

            // If NFTGo has no image but Moralis does, use Moralis image
            if ((!nftgoNFT.image || nftgoNFT.image === '')) {
              // Try standard image first
              if (moralisNFT.image && moralisNFT.image !== '') {
                devLog(`Adding missing image for NFT ${normalizedKey} from Moralis`);
                nftgoNFT.image = moralisNFT.image;
              }
              // Try normalized_metadata image if available
              else if (moralisNFT.metadata &&
                      typeof moralisNFT.metadata === 'object' &&
                      moralisNFT.metadata.normalized_metadata &&
                      moralisNFT.metadata.normalized_metadata.image) {
                devLog(`Adding missing image for NFT ${normalizedKey} from Moralis normalized_metadata`);
                nftgoNFT.image = moralisNFT.metadata.normalized_metadata.image;
              }
              // Try collection_logo as last resort
              else if (moralisNFT.collection && moralisNFT.collection.image) {
                devLog(`Adding missing image for NFT ${normalizedKey} from Moralis collection image`);
                nftgoNFT.image = moralisNFT.collection.image;
              }
            }
          }

          return nftgoNFT;
        });

      devLog(`Returning ${enhancedNFTs.length} enhanced NFTs after filtering and metadata enrichment`);
      return enhancedNFTs;
    } catch (moralisError) {
      devError('Error fetching NFTs from Moralis for comparison:', moralisError);
      // If Moralis fails, just return the NFTGo data
      return nftgoNFTs;
    }
  } catch (error) {
    devError('Error fetching NFTs from NFTGo:', error);

    // Fallback to Moralis if NFTGo fails
    try {
      devLog('Falling back to Moralis API due to error');
      return await Moralis.getNFTsByWalletMoralis(walletAddress, chainid);
    } catch (fallbackError) {
      devError('Fallback to Moralis also failed:', fallbackError);
      return [];
    }
  }
}

/**
 * Get marketplace comparison data for an NFT collection
 */
export async function getMarketplaceComparison(): Promise<MarketplaceComparisonData[]> {
  if (MOCK_ENABLED) {
    return getMockComparisonData();
  }

  try {
    const comparisonPromises = Object.entries(marketplaceServices).map(([name, service]) => {
      // Check if the service has the getCollectionStats function
      if (typeof service.getCollectionStats === 'function') {
        return service.getCollectionStats()
          .then(stats => ({
            marketplace: name as MarketplaceName,
            ...stats,
          }))
          .catch(err => {
            devError(`Error getting stats from ${name}:`, err);
            return null;
          });
      } else {
        devLog(`Service ${name} does not have getCollectionStats function`);
        return Promise.resolve(null);
      }
    });

    const results = await Promise.all(comparisonPromises);
    return results.filter(Boolean) as MarketplaceComparisonData[];
  } catch (error) {
    devError('Error getting marketplace comparison:', error);
    return [];
  }
}

// Mock data functions for development
function getMockNFTs(walletAddress: string): NFT[] {
  return [
    {
      id: '1',
      name: 'Bored Ape #1234',
      description: 'A bored ape from the Bored Ape Yacht Club collection',
      image: 'https://placehold.co/600x600/png?text=Bored+Ape+%231234',
      tokenId: '1234',
      contractAddress: '0x123...abc',
      owner: walletAddress,
      collection: {
        name: 'Bored Ape Yacht Club',
      },
      lastPrice: {
        payment_token: {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          decimals: 18
        },
        raw_value: '80000000000000000000',
        usd: 240000,
        value: 80
      },
    },
    {
      id: '2',
      name: 'Azuki #5678',
      description: 'An Azuki NFT from the popular collection',
      image: 'https://placehold.co/600x600/png?text=Azuki+%235678',
      tokenId: '5678',
      contractAddress: '0x456...def',
      owner: walletAddress,
      collection: {
        name: 'Azuki',
      },
      lastPrice: {
        payment_token: {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          decimals: 18
        },
        raw_value: '12500000000000000000',
        usd: 37500,
        value: 12.5
      },
    },
    {
      id: '3',
      name: 'Doodle #9012',
      description: 'A colorful Doodle NFT',
      image: 'https://placehold.co/600x600/png?text=Doodle+%239012',
      tokenId: '9012',
      contractAddress: '0x789...ghi',
      owner: walletAddress,
      collection: {
        name: 'Doodles',
      },
      lastPrice: {
        payment_token: {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          decimals: 18
        },
        raw_value: '8200000000000000000',
        usd: 24600,
        value: 8.2
      },
    },
  ];
}


function getMockComparisonData(): MarketplaceComparisonData[] {
  return [
    {
      marketplace: 'opensea',
      floorPrice: 75.5,
      volume24h: 450,
      listings: 120,
      avgPrice: 82.3,
    },
    {
      marketplace: 'rarible',
      floorPrice: 76.2,
      volume24h: 320,
      listings: 85,
      avgPrice: 83.1,
    },
    {
      marketplace: 'magiceden',
      floorPrice: 74.8,
      volume24h: 280,
      listings: 95,
      avgPrice: 81.5,
    },
    {
      marketplace: 'looksrare',
      floorPrice: 73.9,
      volume24h: 520,
      listings: 150,
      avgPrice: 80.2,
    },
  ];
}