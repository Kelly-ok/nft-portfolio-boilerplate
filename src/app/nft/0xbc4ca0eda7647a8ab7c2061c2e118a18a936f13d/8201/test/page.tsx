'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import * as NFTGo from '@/services/marketplace/nftgo';
import { Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ETHBlack, ETHPink } from '@/components/icons/CryptoIcons';

export default function BAYCTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [nftData, setNftData] = useState<any>(null);
  const [offersData, setOffersData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  console.log(nftData)

  // BAYC #8201 details
  const contractAddress = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d';
  const tokenId = '8201';

  // Function to fetch offers for the NFT
  const fetchOffers = useCallback(async () => {
    try {
      const offers = await NFTGo.getOffersForNFT(contractAddress, tokenId);
      console.log('Offers Data:', offers);
      setOffersData(offers);
    } catch (err) {
      console.error('Error fetching offers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  }, [contractAddress, tokenId]);

  // Function to fetch NFT data
  const fetchNFTData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch NFT data directly from the API
      const response = await fetch(`/api/nftgo/nft/detail?contract=${contractAddress}&tokenId=${tokenId}`);

      if (!response.ok) {
        throw new Error(`Error fetching NFT data: ${response.status}`);
      }

      const data = await response.json();
      console.log('NFT Data:', data);
      setNftData(data);

      // Now fetch offers for this NFT
      await fetchOffers();
    } catch (err) {
      console.error('Error fetching NFT data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, tokenId, fetchOffers]);

  // Fetch data on page load
  useEffect(() => {
    fetchNFTData();
  }, [fetchNFTData]);

  // Format price for display - returns JSX with icon
  const formatPrice = (price: any) => {
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
        <span className="flex items-center">
          <span>{formatNumber(amount)}</span>
          <ETHBlack className="ml-1 w-3 h-5" />
        </span>
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
        <span className="flex items-center gap-1">
          {getTokenIcon(symbol)}
          <span>{formatNumber(amount)}</span>
        </span>
      );
    }

    // Handle NFTGo last_sale price format
    if (typeof price === 'object' && price.value !== undefined) {
      const value = typeof price.value === 'string' ? parseFloat(price.value) : price.value;
      const currency = price.payment_token?.symbol || 'ETH';

      return (
        <span className="flex items-center">
          <span>{formatNumber(value)}</span>
          {getTokenIcon(currency)}
        </span>
      );
    }

    // Handle simple number or string
    if (typeof price === 'number') {
      return (
        <span className="flex items-center">
          <span>{formatNumber(price)}</span>
          <ETHBlack className="ml-1 w-3 h-5" />
        </span>
      );
    }

    if (typeof price === 'string') {
      try {
        const value = parseFloat(price);
        return (
          <span className="flex items-center">
            <span>{formatNumber(value)}</span>
            <ETHBlack className="ml-1 w-3 h-5" />
          </span>
        );
      } catch (error) {
        console.warn('Error parsing price string:', error);
        return <span>{price}</span>;
      }
    }

    // Fallback for unknown formats - convert to a more readable format
    if (typeof price === 'object') {
      try {
        // Try to extract meaningful price information
        if (price.raw_value) {
          const value = parseFloat(price.raw_value) / 1e18;
          return (
            <span className="flex items-center">
              <span>{formatNumber(value)}</span>
              <ETHBlack className="ml-1 w-3 h-5" />
            </span>
          );
        }

        if (price.decimal) {
          const value = parseFloat(price.decimal);
          return (
            <span className="flex items-center">
              <span>{formatNumber(value)}</span>
              <ETHBlack className="ml-1 w-3 h-5" />
            </span>
          );
        }

        // If we can't extract meaningful information, return a simplified message
        return <span>Complex price object</span>;
      } catch (error) {
        console.warn('Error parsing complex price object:', error);
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
    const now = new Date();

    // If the date is in the future, calculate time remaining
    if (date > now) {
      const diffMs = date.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      } else {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
      }
    }

    // If the date is in the past, return the formatted date
    return date.toLocaleString();
  };

  // Get Etherscan URL for an address
  const getExplorerUrl = (address: string) => {
    if (!address) return '#';
    return `https://etherscan.io/address/${address}`;
  };

  // Extract USD price from complex price object
  const getUsdPrice = (price: any): string | null => {
    if (!price) return null;

    // Format USD with Intl.NumberFormat
    const formatUsd = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    };

    // Handle direct usd_price property
    if (price.usd_price) {
      return formatUsd(parseFloat(price.usd_price));
    }

    // Handle NFTGo price format with amount.usd
    if (typeof price === 'object' && price.amount && typeof price.amount === 'object' && price.amount.usd) {
      return formatUsd(parseFloat(price.amount.usd));
    }

    // Handle direct usd property
    if (price.usd) {
      return formatUsd(parseFloat(price.usd));
    }

    return null;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center mb-6">
        <Link href={`/nft/${contractAddress}/${tokenId}`} className="mr-4">
          <Button variant="outline" size="sm" className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to NFT
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">BAYC #8201 Test Page</h1>
      </div>

      <div className="mb-6">
        <Button
          onClick={fetchNFTData}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Refresh Data'
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p>{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Loading NFT data...</span>
        </div>
      )}

      {nftData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>NFT Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                {nftData.image && (
                  <div className="w-full md:w-1/2">
                    <img
                      src={nftData.image}
                      alt={nftData.name || 'NFT Image'}
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                )}
                <div className="w-full md:w-1/2">
                  <h3 className="text-xl font-bold">{nftData.name || `#${tokenId}`}</h3>
                  <p className="text-sm text-zinc-500 mb-4">{nftData.collection_name}</p>

                  {/* Basic NFT Info */}
                  <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-zinc-500">Contract</p>
                        <a
                          href={`https://etherscan.io/address/${contractAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {contractAddress.substring(0, 6)}...{contractAddress.substring(contractAddress.length - 4)}
                        </a>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Token ID</p>
                        <p className="text-sm font-medium">{tokenId}</p>
                      </div>
                    </div>
                  </div>

                  {/* Market Data */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-300">Market Data</h4>

                    {/* Best Offer Card */}
                    {nftData.best_offer && (
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
                                  case 'blur':
                                    marketplaceLogo = 'https://static.nftgo.io/marketplace/Blur.svg';
                                    break;
                                  case 'looksrare':
                                    marketplaceLogo = 'https://static-image.nftgo.io/marketplace/looksrare.svg';
                                    break;
                                  case 'x2y2':
                                    marketplaceLogo = 'https://static-image.nftgo.io/marketplace/x2y2.svg';
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

                    {/* Last Sale Card */}
                    {nftData.last_sale && (
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

                    {/* Best Listing Card */}
                    {nftData.best_listing && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Best Listing</p>
                          {nftData.best_listing.market_id && (
                            <div className="flex items-center">
                              {(() => {
                                let marketplaceLogo = '';
                                switch(nftData.best_listing.market_id.toLowerCase()) {
                                  case 'opensea':
                                    marketplaceLogo = 'https://static.nftgo.io/marketplace/Opensea.svg';
                                    break;
                                  case 'blur':
                                    marketplaceLogo = 'https://static.nftgo.io/marketplace/Blur.svg';
                                    break;
                                  case 'looksrare':
                                    marketplaceLogo = 'https://static-image.nftgo.io/marketplace/looksrare.svg';
                                    break;
                                  case 'x2y2':
                                    marketplaceLogo = 'https://static-image.nftgo.io/marketplace/x2y2.svg';
                                    break;
                                  default:
                                    marketplaceLogo = '';
                                }

                                return marketplaceLogo ? (
                                  <img
                                    src={marketplaceLogo}
                                    alt={nftData.best_listing.market_id}
                                    className="h-4 w-4"
                                  />
                                ) : (
                                  <span className="text-xs text-zinc-500">{nftData.best_listing.market_id}</span>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center">
                          <div className="text-lg font-bold text-purple-800 dark:text-purple-300">
                            {formatPrice(nftData.best_listing.price)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {nftData.description && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-300">Description</h4>
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{nftData.description}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Traits Section */}
              {nftData.traits && nftData.traits.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-300">Traits</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {nftData.traits.map((trait: any, index: number) => (
                      <div
                        key={index}
                        className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-3 rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <p className="text-xs font-medium text-indigo-500 dark:text-indigo-400 uppercase mb-1">{trait.type}</p>
                        <p className="font-semibold text-sm text-indigo-900 dark:text-indigo-300">{trait.value}</p>
                        {trait.percentage !== undefined && (
                          <div className="mt-1 flex items-center">
                            <div className="w-full bg-indigo-200 dark:bg-indigo-700 rounded-full h-1.5">
                              <div
                                className="bg-indigo-600 dark:bg-indigo-400 h-1.5 rounded-full"
                                style={{ width: `${Math.min(trait.percentage * 100, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 ml-2">
                              {(trait.percentage * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Raw NFT Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(nftData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {offersData && offersData.length > 0 && (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center">
              <CardTitle>Offers</CardTitle>
              <div className="ml-2 w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="sr-only">Show menu</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m6 9 6 6 6-6"/>
              </svg>
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
                {offersData.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500">
                    No offers available for this NFT
                  </div>
                ) : (
                  offersData.map((offer, index) => {
                  // Get marketplace logo based on market_id
                  let marketplaceLogo = '';
                  switch(offer.market_id?.toLowerCase()) {
                    case 'opensea':
                      marketplaceLogo = 'https://static.nftgo.io/marketplace/Opensea.svg';
                      break;
                    case 'looksrare':
                      marketplaceLogo = 'https://static-image.nftgo.io/marketplace/looksrare.svg';
                      break;
                    default:
                      marketplaceLogo = '';
                  }

                  return (
                    <div key={index} className="grid grid-cols-6 items-center py-3 px-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                      <div className="flex items-center">
                        {marketplaceLogo && (
                          <img
                            src={marketplaceLogo}
                            alt={offer.market_id}
                            className="h-5 w-5 mr-2"
                          />
                        )}
                        <div>
                          <div className="font-medium">{formatPrice(offer.price)}</div>
                          {getUsdPrice(offer.price) && (
                            <div className="text-xs text-zinc-500 font-medium">{getUsdPrice(offer.price)}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-sm">
                        <a
                          href={getExplorerUrl(offer.maker)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {offer.maker?.substring(0, 6)}...{offer.maker?.substring(offer.maker.length - 4)}
                        </a>
                      </div>
                      <div className="text-sm">
                        {formatDate(offer.order_expiration_time)}
                      </div>
                      <div className="text-sm">
                        {offer.quantity_remaining || 1}
                      </div>
                      <div className="text-sm">
                        {offer.criteria?.kind === 'token' ? 'Token Offer' : 'Collection Offer'}
                      </div>
                      <div>
                        {/* Get marketplace URL based on market_id */}
                        {(() => {
                          let marketplaceUrl = '#';
                          switch(offer.market_id?.toLowerCase()) {
                            case 'opensea':
                              marketplaceUrl = `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
                              break;
                            case 'looksrare':
                              marketplaceUrl = `https://looksrare.org/collections/${contractAddress}/${tokenId}`;
                              break;
                            default:
                              marketplaceUrl = '#';
                          }

                          return (
                            <a
                              href={marketplaceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>View on {offer.market_id.charAt(0).toUpperCase() + offer.market_id.slice(1)}</span>
                            </a>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {offersData && offersData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Raw Offers Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg overflow-auto max-h-96 text-xs">
              {JSON.stringify(offersData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
