'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useNFTs } from '@/context/NFTContext';
import { NFT } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft, Clock, Tag, RefreshCw, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import NFTGoAcceptBidModal from '@/components/marketplace/NFTGoAcceptBidModal';
import TraitsModal from '@/components/ui/TraitsModal';
import { useAccount } from 'wagmi';
import { ETHBlack, ETHPink } from '@/components/icons/CryptoIcons';

export default function NFTOffersPage() {
  const params = useParams();
  const { contractAddress, tokenId } = params;
  const { nfts, getBidsForNFT, fetchOffersForNFT, isLoading, isNFTListed, getListingInfo } = useNFTs();
  const { chain } = useAccount();
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [selectedBidId, setSelectedBidId] = useState<string | undefined>(undefined);
  const [selectedBidSource, setSelectedBidSource] = useState<any>(null);
  const [isAcceptBidModalOpen, setIsAcceptBidModalOpen] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const [bids, setBids] = useState<any[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [nftData, setNftData] = useState<any>(null);

  // Find the NFT based on the URL parameters
  useEffect(() => {
    if (nfts.length > 0 && contractAddress && tokenId) {
      const nft = nfts.find(
        (n) =>
          n.contractAddress.toLowerCase() === (contractAddress as string).toLowerCase() &&
          n.tokenId === tokenId
      );
      if (nft) {
        setSelectedNFT(nft);
      }
    }
  }, [nfts, contractAddress, tokenId]);

  // Function to fetch NFT data from NFTGo API
  const fetchNFTData = useCallback(async () => {
    if (!contractAddress || !tokenId) return;

    try {
      // Fetch NFT data directly from the API
      const response = await fetch(`/api/nftgo/nft/detail?contract=${contractAddress}&tokenId=${tokenId}`);

      if (!response.ok) {
        throw new Error(`Error fetching NFT data: ${response.status}`);
      }

      const data = await response.json();
      console.log('NFT Data from NFTGo:', data);
      setNftData(data);
    } catch (err) {
      console.error('Error fetching NFT data:', err);
    }
  }, [contractAddress, tokenId]);

  // Function to load offers from NFTGo API
  const loadOffers = useCallback(async () => {
    if (!selectedNFT) return;

    setIsLoadingOffers(true);
    try {
      const offers = await fetchOffersForNFT(selectedNFT);
      console.log('Fetched offers:', offers);
      setBids(offers);
    } catch (error) {
      console.error('Error fetching offers:', error);
    } finally {
      setIsLoadingOffers(false);
    }
  }, [selectedNFT, fetchOffersForNFT, setBids, setIsLoadingOffers]);

  // Fetch NFT data from NFTGo API when component mounts
  useEffect(() => {
    if (contractAddress && tokenId) {
      fetchNFTData();
    }
  }, [contractAddress, tokenId, fetchNFTData]);

  // Get bids for the selected NFT
  useEffect(() => {
    if (selectedNFT) {
      // First get any cached bids
      const cachedBids = getBidsForNFT(selectedNFT);
      setBids(cachedBids);

      // Then fetch fresh bids
      loadOffers();
    }
  }, [selectedNFT, getBidsForNFT, loadOffers]);

  // Format price for display
  const formatPrice = (price: any, includeUsd = true) => {
    if (!price) return (
      <span className="flex items-center">
        <span>0.0000</span>
        <ETHBlack className="ml-1 w-3 h-5" />
      </span>
    );

    // Format number with Intl.NumberFormat
    const formatNumber = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      }).format(value);
    };

    // Get the appropriate ETH icon based on symbol
    const getTokenIcon = (symbol: string) => {
      if (!symbol) return <ETHBlack className="ml-1 w-3 h-5" />;

      const symbolLower = symbol.toLowerCase();
      if (symbolLower === 'weth') {
        return <ETHPink className="ml-1 w-3 h-5" />;
      } else if (symbolLower === 'eth' || symbolLower === 'beth') {
        return <ETHBlack className="ml-1 w-3 h-5" />;
      }

      // For other tokens, just return the symbol as text
      return <span className="ml-1">{symbol}</span>;
    };

    // Handle NFTGo price format with fee_bps
    if (typeof price === 'object' && price.fee_bps !== undefined) {
      const amount = parseFloat(price.amount || '0');
      return (
        <div className="flex flex-col">
          <div className="flex items-center font-bold">
            <span>{formatNumber(amount)}</span>
            <ETHBlack className="ml-1 w-3 h-5" />
          </div>
          {includeUsd && price.usd_price && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price.usd_price)}
            </span>
          )}
        </div>
      );
    }

    // Handle NFTGo price format with currency and amount objects
    if (typeof price === 'object' && price.currency && price.amount) {
      const symbol = price.currency.symbol || 'ETH';
      let amount = 0;

      // Handle amount as object or string/number
      if (typeof price.amount === 'object') {
        amount = parseFloat(price.amount.decimal || price.amount.platform || '0');
      } else {
        amount = parseFloat(price.amount);
      }

      return (
        <div className="flex flex-col">
          <div className="flex items-center font-bold">
            <span>{formatNumber(amount)}</span>
            {getTokenIcon(symbol)}
          </div>
          {includeUsd && price.amount.usd && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price.amount.usd)}
            </span>
          )}
        </div>
      );
    }

    // Handle NFTGo last_sale price format
    if (typeof price === 'object' && price.value !== undefined) {
      const value = typeof price.value === 'string' ? parseFloat(price.value) : price.value;
      const currency = price.payment_token?.symbol || 'ETH';

      return (
        <div className="flex flex-col">
          <div className="flex items-center font-bold">
            <span>{formatNumber(value)}</span>
            {getTokenIcon(currency)}
          </div>
          {includeUsd && price.usd && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price.usd)}
            </span>
          )}
        </div>
      );
    }

    // Handle simple number or string
    if (typeof price === 'number') {
      return (
        <div className="flex items-center font-bold">
          <span>{formatNumber(price)}</span>
          <ETHBlack className="ml-1 w-3 h-5" />
        </div>
      );
    }

    if (typeof price === 'string') {
      try {
        const value = parseFloat(price);
        return (
          <div className="flex items-center font-bold">
            <span>{formatNumber(value)}</span>
            <ETHBlack className="ml-1 w-3 h-5" />
          </div>
        );
      } catch (error) {
        console.error('Error parsing price string:', error);
        return <span>{price}</span>;
      }
    }

    // Fallback for unknown formats
    if (typeof price === 'object') {
      try {
        // Try to extract meaningful price information
        if (price.raw_value) {
          const value = parseFloat(price.raw_value) / 1e18;
          return (
            <div className="flex items-center font-bold">
              <span>{formatNumber(value)}</span>
              <ETHBlack className="ml-1 w-3 h-5" />
            </div>
          );
        }

        if (price.decimal) {
          const value = parseFloat(price.decimal);
          return (
            <div className="flex items-center font-bold">
              <span>{formatNumber(value)}</span>
              <ETHBlack className="ml-1 w-3 h-5" />
            </div>
          );
        }

        // If we can't extract meaningful information, return a simplified message
        return <span>Complex price object</span>;
      } catch (error) {
        console.error('Error parsing complex price object:', error);
        return <span>Invalid price format</span>;
      }
    }

    return <span>Unknown price format</span>;
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';

    // NFTGo timestamps are in seconds, but some might be in milliseconds
    // If the timestamp is too large (> year 3000), it's likely in milliseconds
    const date = new Date(timestamp > 32503680000 ? timestamp : timestamp * 1000);
    return date.toLocaleString();
  };

  // Handle accepting a bid
  const handleAcceptBid = (bidId: string, bid?: any) => {
    console.log('Accepting bid with ID:', bidId);
    console.log('Bid Object:', bid);

    // Close any existing modal first
    setIsAcceptBidModalOpen(false);

    // Reset state
    setSelectedBidId(undefined);
    setSelectedBidSource(null);

    // For NFTGo API, we need to use the order_id or order_hash
    let finalBidId = bidId;

    // If this is an NFTGo offer, use the order_id
    if (bid && bid.order_id) {
      finalBidId = bid.order_id;
    }

    // Set the bid ID and source immediately
    setSelectedBidId(finalBidId);

    if (bid) {
      setSelectedBidSource(getSourceInfo(bid));
    } else {
      // If no bid is provided, find it by ID
      const selectedBid = bids.find(b => b.id === bidId || b.order_id === bidId || b.order_hash === bidId);
      if (selectedBid) {
        setSelectedBidSource(getSourceInfo(selectedBid));
      }
    }

    // Open the modal after a short delay to ensure state is updated
    setTimeout(() => {
      console.log('Opening modal with bid ID:', finalBidId);
      setIsAcceptBidModalOpen(true);
    }, 100);
  };

  // Handle closing the accept bid modal
  const handleCloseAcceptBidModal = () => {
    setIsAcceptBidModalOpen(false);
    setSelectedBidId(undefined);
    setSelectedBidSource(null);
  };



  // Handle showing traits modal
  const handleShowTraits = () => {
    setShowTraits(true);
  };

  // Handle closing traits modal
  const handleCloseTraits = () => {
    setShowTraits(false);
  };

  // Get the explorer URL based on the chain
  const getExplorerUrl = (address: string) => {
    if (!address) return '#';

    const chainId = chain?.id;
    let baseUrl = 'https://etherscan.io/address/';

    if (chainId === 56) {
      baseUrl = 'https://bscscan.com/address/';
    } else if (chainId === 137) {
      baseUrl = 'https://polygonscan.com/address/';
    }

    return `${baseUrl}${address}`;
  };

  // Get marketplace source info
  const getSourceInfo = (bid: any) => {
    // Handle NFTGo marketplace format
    if (bid && bid.market_id) {
      // Map NFTGo marketplace IDs to names and icons
      const marketplaceMap: Record<string, { name: string, icon: string }> = {
        'opensea': {
          name: 'OpenSea',
          icon: 'https://static.nftgo.io/marketplace/Opensea.svg'
        },
        'looksrare': {
          name: 'LooksRare',
          icon: 'https://static-image.nftgo.io/marketplace/looksrare.svg'
        },
        'nftgo': {
          name: 'NFTGo',
          icon: 'https://files.readme.io/cdb645a-Vertical.svg'
        }
      };

      const marketInfo = marketplaceMap[bid.market_id.toLowerCase()] || {
        name: bid.market_id.charAt(0).toUpperCase() + bid.market_id.slice(1),
        icon: '/images/marketplace-placeholder.svg'
      };

      return {
        name: marketInfo.name,
        icon: marketInfo.icon,
        url: '#' // NFTGo doesn't provide direct URLs to offers
      };
    }

    // Handle generic source format with name, icon, and url properties
    if (bid && bid.source) {
      return {
        name: bid.source.name || 'Unknown',
        icon: bid.source.icon || '/images/marketplace-placeholder.svg',
        url: bid.source.url ? bid.source.url.replace('${tokenId}', selectedNFT?.tokenId || '') : '#'
      };
    }

    return null;
  };



  if (isLoading) {
    return (
      <div className="min-h-screen p-8 pb-20 gap-8 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center mb-6">
            <Link href="/" className="mr-4">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Loading...</h1>
          </div>
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  if (!selectedNFT) {
    return (
      <div className="min-h-screen p-8 pb-20 gap-8 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center mb-6">
            <Link href="/" className="mr-4">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">NFT Not Found</h1>
          </div>
          <p>The NFT you are looking for could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 pb-20 gap-8 sm:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/" className="mr-4">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{selectedNFT.name} - Offers</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* NFT Preview */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>NFT Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-6">
                  {/* NFT Image */}
                  <div className="w-full">
                    <img
                      src={selectedNFT.image || '/images/placeholder-nft.svg'}
                      alt={selectedNFT.name}
                      className="w-full h-auto rounded-lg"
                    />
                  </div>

                  <div className="w-full">
                    <h3 className="text-xl font-bold">{selectedNFT.name}</h3>
                    {selectedNFT.collection && (
                      <p className="text-sm text-zinc-500 mb-4">{selectedNFT.collection.name}</p>
                    )}

                    {/* Basic NFT Info */}
                    <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-zinc-500">Contract</p>
                          <a
                            href={`https://etherscan.io/address/${selectedNFT.contractAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline"
                          >
                            {selectedNFT.contractAddress.substring(0, 6)}...{selectedNFT.contractAddress.substring(selectedNFT.contractAddress.length - 4)}
                          </a>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Token ID</p>
                          <div className="relative group">
                            <p className="text-sm font-medium truncate max-w-[120px]" title={selectedNFT.tokenId}>
                              {selectedNFT.tokenId}
                            </p>
                            <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded p-2 mt-1 whitespace-normal max-w-xs break-all">
                              {selectedNFT.tokenId}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Market Data */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-300">Market Data</h4>

                      {/* Best Offer Card - Using NFTGo API data */}
                      {nftData && nftData.best_offer && (
                        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Best Offer</p>
                            {nftData.best_offer.market_name && (
                              <div className="flex items-center">
                                {(() => {
                                  let marketplaceLogo = '';
                                  switch(nftData.best_offer.market_name.toLowerCase()) {
                                    case 'opensea':
                                      marketplaceLogo = 'https://static.nftgo.io/marketplace/Opensea.svg';
                                      break;
                                    case 'looksrare':
                                      marketplaceLogo = 'https://static-image.nftgo.io/marketplace/looksrare.svg';
                                      break;
                                    default:
                                      marketplaceLogo = '';
                                  }

                                  return marketplaceLogo ? (
                                    <img
                                      src={marketplaceLogo}
                                      alt={nftData.best_offer.market_name}
                                      className="h-4 w-4"
                                    />
                                  ) : (
                                    <span className="text-xs text-zinc-500">{nftData.best_offer.market_name}</span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center mb-1">
                            <div className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center">
                              {nftData.best_offer.payment_token?.symbol === 'WETH' ? (
                                <ETHPink className="mr-1 w-4 h-6" />
                              ) : (
                                <ETHBlack className="mr-1 w-4 h-6" />
                              )}
                              {new Intl.NumberFormat('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }).format(nftData.best_offer.value)}
                            </div>
                          </div>

                          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(nftData.best_offer.usd)}
                          </div>
                        </div>
                      )}

                      {/* Last Sale Card - Using NFTGo API data */}
                      {nftData && nftData.last_sale && (
                        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-medium text-green-700 dark:text-green-400">Last Sale</p>
                            {nftData.last_sale.tx_hash && (
                              <a
                                href={nftData.last_sale.tx_url || `https://etherscan.io/tx/${nftData.last_sale.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Transaction
                              </a>
                            )}
                          </div>

                          <div className="flex items-center mb-1">
                            <div className="text-lg font-bold text-green-800 dark:text-green-300 flex items-center">
                              {nftData.last_sale.price?.payment_token?.symbol === 'WETH' ? (
                                <ETHPink className="mr-1 w-4 h-6" />
                              ) : (
                                <ETHBlack className="mr-1 w-4 h-6" />
                              )}
                              {new Intl.NumberFormat('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }).format(nftData.last_sale.price?.value)}
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }).format(nftData.last_sale.price?.usd)}
                            </div>

                            {nftData.last_sale.time && (
                              <div className="text-xs text-green-600 dark:text-green-400">
                                {new Date(nftData.last_sale.time * 1000).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Fallback to bids from context if NFTGo API data is not available */}
                      {!nftData?.best_offer && bids.length > 0 && (
                        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Best Offer</p>
                            {getSourceInfo(bids[0]) && (
                              <div className="flex items-center">
                                <img
                                  src={getSourceInfo(bids[0])?.icon}
                                  alt={getSourceInfo(bids[0])?.name || 'Marketplace'}
                                  className="h-4 w-4"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center mb-1">
                            <div className="text-lg font-bold text-blue-800 dark:text-blue-300">
                              {formatPrice(bids.sort((a, b) => {
                                // Handle NFTGo offer format
                                if (a.price && b.price) {
                                  const priceA = parseFloat(a.price.fee_bps ? a.price.amount : a.price.amount?.decimal || '0');
                                  const priceB = parseFloat(b.price.fee_bps ? b.price.amount : b.price.amount?.decimal || '0');
                                  return priceB - priceA;
                                }
                                return 0;
                              })[0]?.price)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Listing Price Card */}
                      {isNFTListed(selectedNFT) && (
                        <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Current Listing</p>
                            {getListingInfo(selectedNFT)?.expiration && (
                              <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                                <Clock className="h-3 w-3" />
                                {formatDate(getListingInfo(selectedNFT)?.expiration || 0)}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center">
                            <div className="text-lg font-bold text-purple-800 dark:text-purple-300">
                              {(() => {
                                const listingInfo = getListingInfo(selectedNFT);
                                if (!listingInfo || !listingInfo.price) {
                                  return (
                                    <span className="flex items-center">
                                      <span>0.00</span>
                                      <ETHBlack className="ml-1 w-3 h-5" />
                                    </span>
                                  );
                                }

                                // Format price with 2 decimal places
                                const priceValue = typeof listingInfo.price === 'string'
                                  ? parseFloat(listingInfo.price)
                                  : typeof listingInfo.price === 'number'
                                    ? listingInfo.price
                                    : 0;

                                return (
                                  <span className="flex items-center">
                                    <span>{priceValue.toFixed(2)}</span>
                                    <ETHBlack className="ml-1 w-3 h-5" />
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {selectedNFT.description && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-300">Description</h4>
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectedNFT.description}</p>
                        </div>
                      </div>
                    )}

                    {/* Traits Button */}
                    {((selectedNFT.metadata && selectedNFT.metadata.length > 0) || (selectedNFT.attributes && selectedNFT.attributes.length > 0)) && (
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          onClick={handleShowTraits}
                          className="w-full"
                        >
                          <Tag className="h-4 w-4 mr-2" />
                          View Traits
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Offers List */}
          <div id="offers" className="md:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center">
                  <CardTitle>Offers</CardTitle>
                  <div className="ml-2 w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadOffers}
                  disabled={isLoadingOffers}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingOffers ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  {/* Table Header */}
                  <div className="grid grid-cols-6 border-b py-3 px-4 text-sm font-medium text-zinc-500">
                    <div>Unit Price</div>
                    <div>From</div>
                    <div>Expiration</div>
                    <div>Quantity</div>
                    <div>Type</div>
                    <div>Actions</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y">
                    {bids.length === 0 ? (
                      <div className="py-8 text-center text-zinc-500">
                        No offers available for this NFT
                      </div>
                    ) : (
                      bids.map((bid) => {
                        // Generate a unique key for the bid
                        const bidKey = bid.order_id || bid.order_hash || bid.id || `${bid.maker}-${bid.price?.amount || bid.price?.amount?.decimal || Math.random()}`;

                        // Get the expiration time
                        const expirationTime = bid.order_expiration_time || bid.validUntil || null;

                        // Get the maker address
                        const makerAddress = bid.maker || '';

                        // Get marketplace logo
                        let marketplaceLogo = '';
                        if (bid.market_id) {
                          switch(bid.market_id.toLowerCase()) {
                            case 'opensea':
                              marketplaceLogo = 'https://static.nftgo.io/marketplace/Opensea.svg';
                              break;
                            case 'looksrare':
                              marketplaceLogo = 'https://static-image.nftgo.io/marketplace/looksrare.svg';
                              break;
                            default:
                              marketplaceLogo = '';
                          }
                        }

                        return (
                          <div key={bidKey} className="grid grid-cols-6 items-center py-3 px-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <div className="flex items-center">
                              {marketplaceLogo && (
                                <img
                                  src={marketplaceLogo}
                                  alt={bid.market_id}
                                  className="h-5 w-5 mr-2"
                                />
                              )}
                              <div>
                                <div className="font-medium">{formatPrice(bid.price, false)}</div>
                                {bid.price && bid.price.usd_price && (
                                  <div className="text-xs text-zinc-500 font-medium">
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'USD',
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    }).format(bid.price.usd_price)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-sm">
                              <a
                                href={getExplorerUrl(makerAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {makerAddress?.substring(0, 6)}...{makerAddress?.substring(makerAddress.length - 4)}
                              </a>
                            </div>
                            <div className="text-sm">
                              {formatDate(expirationTime)}
                            </div>
                            <div className="text-sm">
                              {bid.quantity_remaining || 1}
                            </div>
                            <div className="text-sm">
                              {bid.criteria?.kind === 'token' ? 'Token Offer' : 'Collection Offer'}
                            </div>
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors"
                                onClick={() => handleAcceptBid(bidKey, bid)}
                              >
                                Accept Offer
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Accept Bid Modal */}
      {selectedBidId && (
        <NFTGoAcceptBidModal
          nft={selectedNFT}
          bidId={selectedBidId}
          isOpen={isAcceptBidModalOpen}
          onClose={handleCloseAcceptBidModal}
          sourceInfo={selectedBidSource}
          onSuccess={() => {
            // Refresh offers after successful acceptance
            loadOffers();
          }}
        />
      )}

      {/* Traits Modal */}
      <TraitsModal
        nft={selectedNFT}
        isOpen={showTraits}
        onClose={handleCloseTraits}
      />
    </div>
  );
}
