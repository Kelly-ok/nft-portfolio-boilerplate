'use client';

// Removed Next.js Image import
import { NFT } from '@/types';
import { useNFTs } from '@/context/NFTContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useState, useEffect, useRef } from 'react';
import { Sparkles, CogIcon, TrashIcon, Clock, DollarSign, Tag, Check, ExternalLink } from 'lucide-react';
// Removed Next.js Image import
import { getUniqueAttributes } from '@/utils/formatters';
import TraitsModal from '@/components/ui/TraitsModal';
import CancelListingModal from '@/components/marketplace/CancelListingModal';
import SingleNFTListModal from '@/components/marketplace/SingleNFTListModal';
import NFTGoAcceptBidModal from '@/components/marketplace/NFTGoAcceptBidModal';
import { useRouter } from 'next/navigation';
import { useNFTListings } from '@/hooks/useNFTListings';
import { ListingActions } from '@/components/marketplace/ListingActions';
import { usePrice } from '@/context/PriceContext';
import NFTMedia from '@/components/nft/NFTMedia';

interface NFTCardProps {
  nft: NFT;
  onCancelClick?: (nft: NFT) => void;
  onListClick?: (nft: NFT) => void;
  onEditClick?: (nft: NFT) => void;
  onViewOffersClick?: (nft: NFT) => void;
  selectionMode?: boolean; // Enable multi-selection mode
}

export default function NFTCard({ nft, onCancelClick, onListClick, onEditClick, onViewOffersClick, selectionMode = false }: NFTCardProps) {
  const router = useRouter();
  const [showTraits, setShowTraits] = useState(false);
  const { ethPrice } = usePrice();
  const {
    isNFTListed,
    getListingInfo,
    refreshNFTs,
    hasOffersForNFT,
    toggleNFTSelection
  } = useNFTs();

  // Use the NFTListings hook to get listings for this NFT - only if the NFT is owned by the current user
  const {
    getListingsForNFT,
    refreshListings
  } = useNFTListings(
    // Only fetch listings if the NFT is owned by the current user to reduce API calls
    isNFTListed(nft) ? nft.owner : undefined,
    isNFTListed(nft) ? [nft] : undefined
  );

  // Refresh listings when the NFT changes - using a ref to prevent excessive refreshes
  const nftIdRef = useRef(`${nft.contractAddress}:${nft.tokenId}`);

  useEffect(() => {
    const currentNftId = `${nft.contractAddress}:${nft.tokenId}`;

    // Only refresh if the NFT has changed or is newly listed
    if (isNFTListed(nft) && (nftIdRef.current !== currentNftId)) {
      nftIdRef.current = currentNftId;
      refreshListings();
    }
  }, [nft.contractAddress, nft.tokenId, isNFTListed, refreshListings, nft]);

  // State for modals
  const [isAcceptBidModalOpen, setIsAcceptBidModalOpen] = useState(false);
  const [isMagicEdenListModalOpen, setIsMagicEdenListModalOpen] = useState(false);

  const handleCloseTraits = () => {
    setShowTraits(false);
  };

  const handleCloseAcceptBidModal = () => {
    setIsAcceptBidModalOpen(false);
  };

  const { openEditModal } = useNFTs();

  const handleListClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (onListClick) {
      onListClick(nft);
    } else {
      // Use Magic Eden modal for listing
      setIsMagicEdenListModalOpen(true);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (onEditClick) {
      onEditClick(nft);
    } else {
      openEditModal(nft);
    }
  };

  const handleViewOffersClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (onViewOffersClick) {
      onViewOffersClick(nft);
    } else {
      // Navigate to the offers page for this NFT
      router.push(`/nft/${nft.contractAddress}/${nft.tokenId}/offers`);
    }
  };

  // Create a state for cancel modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (onCancelClick) {
      onCancelClick(nft);
    } else {
      // Open the cancel modal directly
      setIsCancelModalOpen(true);
    }
  };

  const handleCloseCancelModal = () => {
    setIsCancelModalOpen(false);
  };

  // Get listing info if NFT is listed
  const listingInfo = isNFTListed(nft) ? getListingInfo(nft) : null;

    // Get currency with fallbacks
    const getCurrency = () => {
      if (listingInfo?.currency) return listingInfo.currency;
      if (nft.lastPrice?.payment_token?.symbol) return nft.lastPrice?.payment_token?.symbol;
      return 'ETH';
    };

  // Format price for display with proper fallbacks
  const formatPrice = (price: any) => {
    if (!price) return '0';
    if (typeof price === 'object') {
      // Handle complex price object structure
      const amount = price.amount?.decimal || price.netAmount?.decimal || '0';
      const usd = price.amount?.usd ?
        `(${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price.amount.usd)})` :
        '';
      return `${amount} ${getCurrency()} ${usd}`;
    }

    // For simple price values, just return the value as a string
    // USD conversion is handled separately in the UI
    return typeof price === 'number' ? price.toString() : price;
  };

  // Helper function to check if an NFT has traits
  const hasTraits = (nft: NFT): boolean => {
    // Get unique attributes using our utility function
    const uniqueAttributes = getUniqueAttributes(nft);

    return uniqueAttributes.length > 0;
  };

  // Handle NFT selection
  const handleCardClick = () => {
    if (selectionMode) {
      toggleNFTSelection(nft);
    }
  };

  return (
    <Card
      className={`overflow-hidden rounded-xl transition-all hover:shadow-lg border border-gray-200 dark:border-gray-800 flex flex-col h-full ${selectionMode ? 'cursor-pointer' : ''} ${nft.selected ? 'ring-2 ring-indigo-500 shadow-lg' : ''}`}
      onClick={handleCardClick}
    >
      <div className="relative w-full aspect-square overflow-hidden">
        {/* Selection indicator */}
        {selectionMode && nft.selected && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full p-1.5 z-20 shadow-md">
            <Check className="h-4 w-4" />
          </div>
        )}

        {isNFTListed(nft) && (
          <>
            <div className="absolute top-2 left-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-medium px-3 py-1 rounded-full z-10 shadow-sm flex items-center">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
              Listed
            </div>
            {listingInfo?.expiresAt && (
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-medium px-3 py-1 rounded-full z-10 flex items-center gap-1.5 backdrop-blur-sm shadow-sm">
                <Clock className="h-3 w-3" />
                {(() => {
                  try {
                    // Ensure expiresAt is a valid Date object
                    const expirationDate = listingInfo.expiresAt instanceof Date
                      ? listingInfo.expiresAt
                      : new Date(listingInfo.expiresAt);

                    // Check if the date is valid
                    if (isNaN(expirationDate.getTime())) {
                      return 'Invalid date';
                    }

                    return `${expirationDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | ${expirationDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                  } catch (error) {
                    console.error('Error formatting expiration date:', error, listingInfo.expiresAt);
                    return 'Invalid date';
                  }
                })()}
              </div>
            )}
          </>
        )}
        <div className="relative w-full h-full group">
          <NFTMedia
            src={nft.image || nft.collection?.image}
            alt={nft.name || 'NFT Media'}
            className="object-cover w-full h-full aspect-square"
            gateway="https://ipfs.io"
            showControls={true}
            autoPlay={false}
            loop={true}
            muted={true}
          />
          <a
            href={`https://opensea.io/assets/ethereum/${nft.contractAddress}/${nft.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white font-medium flex items-center space-x-1">
              <ExternalLink className="h-4 w-4" />
              <span>View on OpenSea</span>
            </div>
          </a>
        </div>

        {/* Show asking price badge if NFT is listed */}
        {isNFTListed(nft) && listingInfo && (
          <div className="absolute bottom-2 left-2 bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white text-xs font-medium px-3 py-1.5 rounded-full z-10 backdrop-blur-sm shadow-sm flex items-center gap-1">
            {formatPrice(listingInfo.price)} {getCurrency()}
          </div>
        )}
        {/* Show traits button if traits are available - position based on whether NFT is listed */}
        {hasTraits(nft) && (
          <button
            className={`absolute ${isNFTListed(nft) ? 'bottom-12 right-2 z-20' : 'top-2 right-2'} flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm shadow-sm hover:bg-black/70 transition-colors`}
            onClick={(e) => {
              e.stopPropagation();
              setShowTraits(true);
            }}
          >
            <Sparkles className="h-3 w-3" />
            <span>Traits</span>
          </button>
        )}

        {/* Show marketplace icons if NFT is listed */}
        {isNFTListed(nft) && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 z-20">
            {(() => {
              // Get NFTGo listings for this NFT
              const nftListings = getListingsForNFT(nft);

              // Define marketplace logos and display names mapping
              const marketplaceInfo: Record<string, { logo: string, name: string }> = {
                // OpenSea variations
                'opensea': {
                  logo: 'https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.svg',
                  name: 'OpenSea'
                },
                'seaport': {
                  logo: 'https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.svg',
                  name: 'OpenSea'
                },

                // LooksRare variations
                'looks-rare': {
                  logo: 'https://storage.swapspace.co/static/font/src/looks.svg',
                  name: 'LooksRare'
                },
                'looksrare': {
                  logo: 'https://storage.swapspace.co/static/font/src/looks.svg',
                  name: 'LooksRare'
                },

                // NFTGo variations
                'nftgo': {
                  logo: 'https://files.readme.io/cdb645a-Vertical.svg',
                  name: 'NFTGo'
                },
                'payment-processor': {
                  logo: 'https://files.readme.io/cdb645a-Vertical.svg',
                  name: 'NFTGo'
                },
                'nftgo.io': {
                  logo: 'https://files.readme.io/cdb645a-Vertical.svg',
                  name: 'NFTGo'
                },

                // Other marketplaces
                'blur': {
                  logo: 'https://blur.io/favicon.ico',
                  name: 'Blur'
                },
                'x2y2': {
                  logo: 'https://x2y2.io/favicon.ico',
                  name: 'X2Y2'
                },
                'rarible': {
                  logo: 'https://rarible.com/favicon.ico',
                  name: 'Rarible'
                }
              };

              // Get unique marketplaces where this NFT is listed
              // First, get all the listings for this NFT
              const marketplaceListings = nftListings.map(listing => ({
                // Store both the normalized and original marketplace IDs
                marketplace: listing.marketplace,
                originalMarketplace: listing.originalMarketplace || listing.marketplace
              }));

              // Create a unique list of marketplaces based on the original marketplace ID
              const marketplaces = [...new Set(marketplaceListings.map(listing => listing.originalMarketplace))];

              // Log for debugging
              if (nftListings.length > 0) {
                console.log(`NFT ${nft.contractAddress}:${nft.tokenId} is listed on:`,
                  nftListings.map(listing => `${listing.marketplace} (original: ${listing.originalMarketplace || listing.marketplace})`));
              }

              // If we don't have marketplace information but the NFT is listed,
              // show marketplace logos based on the listing info
              if (marketplaces.length === 0) {
                // Get the listing info to determine which marketplace to show
                const listingInfo = getListingInfo(nft);
                let marketplaceToShow = 'unknown'; // Default to unknown

                // Try to determine the marketplace from the listing info
                if (listingInfo && listingInfo.marketplace) {
                  // Use the marketplace directly from the listingInfo (already normalized in NFTContext)
                  marketplaceToShow = listingInfo.marketplace.toLowerCase();
                } else {
                  console.log(`No listing info or marketplace found for ${nft.id}, defaulting to 'unknown'`);
                }

                // Get the marketplace info, default to a generic icon if unknown
                const info = marketplaceInfo[marketplaceToShow] || {
                  logo: '/images/marketplace-icons/unknown.svg', // Use a generic icon
                  name: 'Marketplace'
                };

                return (
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden group relative">
                      <img
                        src={info.logo}
                        alt={`Listed on ${info.name}`}
                        className="w-4 h-4 object-contain"
                      />

                      {/* Tooltip */}
                      <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30">
                        <div className="bg-black/80 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          Listed on {info.name}
                        </div>
                        <div className="w-2 h-2 bg-black/80 transform rotate-45 absolute -bottom-1 right-2"></div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex items-center">
                  {marketplaces.map((marketplace, index) => {
                    // Normalize marketplace ID to match our UI expectations
                    let normalizedMarketplace = marketplace;

                    // Map market_id to our expected marketplace IDs
                    if (marketplace === 'seaport') {
                      normalizedMarketplace = 'opensea';
                    } else if (marketplace === 'looks-rare') {
                      normalizedMarketplace = 'looksrare';
                    } else if (marketplace === 'payment-processor') {
                      normalizedMarketplace = 'nftgo';
                    }

                    // Log the marketplace mapping for debugging
                    console.log(`Displaying icon for marketplace: ${marketplace} -> ${normalizedMarketplace}`);

                    const info = marketplaceInfo[normalizedMarketplace] || {
                      logo: '/images/placeholder-marketplace.svg',
                      name: normalizedMarketplace.charAt(0).toUpperCase() + normalizedMarketplace.slice(1).replace(/-/g, ' ')
                    };

                    return (
                      <div
                        key={marketplace}
                        className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden group relative"
                        style={{
                          zIndex: 20 - index, // Ensure proper stacking
                          marginLeft: index > 0 ? '-8px' : '0', // Create overlap effect for multiple icons
                        }}
                      >
                        <img
                          src={info.logo}
                          alt={`Listed on ${info.name}`}
                          className="w-4 h-4 object-contain"
                          loading="lazy"
                        />

                        {/* Tooltip */}
                        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30">
                          <div className="bg-black/80 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                            Listed on {info.name}
                          </div>
                          <div className="w-2 h-2 bg-black/80 transform rotate-45 absolute -bottom-1 right-2"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">{nft.name}</CardTitle>
              <div className="flex items-center">
                <div className="px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md text-white text-xs font-mono shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center gap-1">
                  <span className="opacity-70">#</span>
                  <span>{nft.tokenId}</span>
                </div>
              </div>
            </div>
            {nft.collection && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-5 h-5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white text-[10px]">♦</span>
                </div>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                  {nft.collection.name}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400 italic mb-2">
          {nft.description || 'No description available'}
        </p>

        {/* View on Explorer Links */}
        <div className="flex items-center justify-end space-x-2 mt-1">
          <a
            href={`https://opensea.io/assets/ethereum/${nft.contractAddress}/${nft.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-700 transition-colors flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 mr-0.5" />
            <span>OpenSea</span>
          </a>
          <span className="text-zinc-300">|</span>
          <a
            href={`https://etherscan.io/token/${nft.contractAddress}?a=${nft.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-700 transition-colors flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 mr-0.5" />
            <span>Etherscan</span>
          </a>
        </div>
      </CardContent>
      <CardContent className="px-4 pb-0 pt-0 flex-grow">
        {/* Listing Price Section */}
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg dark:from-blue-900/20 dark:to-purple-900/20">
          <p className="text-sm text-blue-600 font-medium mb-2 dark:text-blue-400">Listing Price</p>
          <div className="flex items-center">
            {nft.lastPrice ? (
              <>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(nft.lastPrice.value)}</p>
                <div className="flex flex-col ml-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{nft.lastPrice.payment_token.symbol || 'ETH'}</span>
                  {nft.lastPrice && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      (${new Intl.NumberFormat('en-US').format(parseFloat(String(nft.lastPrice.usd)))})
                    </span>
                  )}
                </div>
              </>
            ) : isNFTListed(nft) && listingInfo ? (
              <>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(listingInfo.price)}</p>
                <div className="flex flex-col ml-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{getCurrency()}</span>
                  {listingInfo.price && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      (${new Intl.NumberFormat('en-US').format(
                        listingInfo.priceUsd || (parseFloat(String(listingInfo.price)) * ethPrice)
                      )})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xl font-medium text-gray-500 dark:text-gray-400">Not listed</p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 mt-auto">
        <div className="grid grid-cols-3 gap-2 w-full">
          {/* Memoize the NFT listings to prevent unnecessary re-renders */}
          {(() => {
            // Get NFTGo listings for this NFT - only if the NFT is listed
            const nftListings = isNFTListed(nft) ? getListingsForNFT(nft) : [];
            const hasNFTGoListings = nftListings.length > 0;

            if (hasNFTGoListings) {
              return (
                <>
                  {/* Show NFTGo listing actions */}
                  <div className="col-span-2">
                    <ListingActions
                      nft={nft}
                      listings={nftListings}
                      refreshListings={refreshListings}
                      onSuccess={() => {
                        refreshNFTs();
                        refreshListings();
                      }}
                      onError={(error) => console.error('Listing action error:', error)}
                      selectionMode={selectionMode}
                    />
                  </div>

                  <Button
                    variant="secondary"
                    className={`rounded-lg shadow-sm bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800 ${selectionMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleViewOffersClick}
                    disabled={selectionMode}
                    iconClass="w-6 h-6 mr-2"
                  >
                    <DollarSign />
                    Offers
                  </Button>
                </>
              );
            } else if (isNFTListed(nft)) {
              return (
                <>
                  {/* Show legacy listing actions */}
                  <Button
                    variant="secondary"
                    className={`rounded-lg shadow-sm bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800 ${selectionMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleCancelClick}
                    disabled={selectionMode}
                    iconClass="w-4 h-4 mr-1"
                  >
                    <TrashIcon size={16} />
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    className={`rounded-lg shadow-sm bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800 ${selectionMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleViewOffersClick}
                    disabled={selectionMode}
                    iconClass="w-4 h-4 mr-1"
                  >
                    <DollarSign size={16} />
                    Offers
                  </Button>
                  <Button
                    variant="gradient"
                    className={`rounded-lg shadow-sm bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white ${selectionMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleEditClick}
                    disabled={selectionMode}
                    iconClass="w-5 h-5 mr-[.2rem]"
                  >
                    <CogIcon size={20} />
                    Edit
                  </Button>
                </>
              );
            } else {
              // Check if the NFT has offers
              const hasOffers = hasOffersForNFT(nft);

              return (
                <>
                  {/* Show list actions */}
                  <Button
                    variant="gradient"
                    className={`rounded-lg shadow-sm bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white ${hasOffers ? 'col-span-2' : 'col-span-3'} ${selectionMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleListClick}
                    disabled={selectionMode}
                    iconClass="w-4 h-4 mr-2"
                  >
                    <Tag  size={18} />
                    List NFT
                  </Button>
                  {hasOffers && (
                    <Button
                      variant="secondary"
                      className={`rounded-lg shadow-sm bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800 ${selectionMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={handleViewOffersClick}
                      disabled={selectionMode}
                      iconClass="w-6 h-6 mr-2"
                    >
                      <DollarSign />
                      Offers
                    </Button>
                  )}
                </>
              );
            }
          })()}
        </div>
      </CardFooter>

      <TraitsModal
        nft={nft}
        isOpen={showTraits}
        onClose={handleCloseTraits}
      />

      {/* Cancel Listing Modal */}
      <CancelListingModal
        nft={nft}
        isOpen={isCancelModalOpen}
        onClose={handleCloseCancelModal}
        onSuccess={() => {
          // Refresh NFTs after successful cancellation
          refreshNFTs();
        }}
      />

      {/* Accept Bid Modal */}
      <NFTGoAcceptBidModal
        nft={nft}
        isOpen={isAcceptBidModalOpen}
        onClose={handleCloseAcceptBidModal}
        onSuccess={() => {
          // Refresh NFTs after successful bid acceptance
          refreshNFTs();
        }}
      />

      {/* NFT List Modal */}
      <SingleNFTListModal
        nft={nft}
        isOpen={isMagicEdenListModalOpen}
        onClose={() => setIsMagicEdenListModalOpen(false)}
        onSuccess={() => refreshNFTs()}
      />
    </Card>
  );
}