'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNFTs } from '@/context/NFTContext';
import { NFT } from '@/types';
import { Loader2, ExternalLink } from 'lucide-react';
import * as NFTGo from '@/services/marketplace/nftgo';
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Pagination
} from "@heroui/react";
import { motion } from 'framer-motion';
import NFTMedia from '@/components/nft/NFTMedia';

// Define the data structure for NFT pricing
interface NFTPricing {
  nft: NFT;
  floorPrice: number | null;
  estimatedPrice: number | null;
  priceRatio: number | null; // Ratio of estimated price to floor price
}

interface NFTPricingTableProps {
  nfts?: NFT[];
  isLoading?: boolean;
}

export default function NFTPricingTable({ nfts: propNfts, isLoading: propIsLoading }: NFTPricingTableProps) {
  // Use props if provided, otherwise use the NFT context
  const nftContext = useNFTs();
  const nfts = propNfts || nftContext.nfts;
  const isLoading = propIsLoading !== undefined ? propIsLoading : nftContext.isLoading;

  // State for data and UI
  const [pricingData, setPricingData] = useState<NFTPricing[]>([]);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isChangingPage, setIsChangingPage] = useState(false); // New state for page change loading
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState({
    column: "nft",
    direction: "ascending" as "ascending" | "descending"
  });
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Constants
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

  // Refs for caching
  const pricingCache = useRef<Map<string, any>>(new Map());
  const fetchInProgress = useRef<boolean>(false);

  // Process data for display - sorting and pagination
  const processedData = useMemo(() => {
    // Sort the data based on current sort descriptor
    const sortedData = [...pricingData].sort((a, b) => {
      if (!sortDescriptor.column) return 0;

      const column = sortDescriptor.column;
      const direction = sortDescriptor.direction === "ascending" ? 1 : -1;

      if (column === "nft") {
        // Sort by collection name first, then by NFT name
        const collectionA = a.nft.collection?.name || '';
        const collectionB = b.nft.collection?.name || '';

        if (collectionA !== collectionB) {
          return collectionA.localeCompare(collectionB) * direction;
        }

        return a.nft.name.localeCompare(b.nft.name) * direction;
      }

      if (column === "floorPrice") {
        if (a.floorPrice === null) return direction;
        if (b.floorPrice === null) return -direction;
        return (a.floorPrice - b.floorPrice) * direction;
      }

      if (column === "estimatedPrice") {
        if (a.estimatedPrice === null) return direction;
        if (b.estimatedPrice === null) return -direction;
        return (a.estimatedPrice - b.estimatedPrice) * direction;
      }

      if (column === "priceRatio") {
        if (a.priceRatio === null) return direction;
        if (b.priceRatio === null) return -direction;
        return (a.priceRatio - b.priceRatio) * direction;
      }

      return 0;
    });

    // Calculate pagination
    const totalPages = Math.ceil(sortedData.length / rowsPerPage);

    // Get paginated items
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedItems = sortedData.slice(start, end);

    // Determine if pagination should be shown
    const showPagination = sortedData.length > rowsPerPage;

    return {
      sortedData,
      paginatedItems,
      totalPages,
      showPagination
    };
  }, [pricingData, sortDescriptor, page, rowsPerPage]);

  // Generate a cache key based on NFT array
  const generateCacheKey = (nftArray: NFT[]) => {
    if (!nftArray || nftArray.length === 0) return '';

    // Sort by contract and token ID to ensure consistent cache keys
    const sortedNFTs = [...nftArray].sort((a, b) => {
      const keyA = `${a.contractAddress}:${a.tokenId}`;
      const keyB = `${b.contractAddress}:${b.tokenId}`;
      return keyA.localeCompare(keyB);
    });

    // Create a string of contract:tokenId pairs
    return sortedNFTs.map(nft => `${nft.contractAddress}:${nft.tokenId}`).join('|');
  };

  // Fetch pricing data when NFTs change
  useEffect(() => {
    // Skip if no NFTs or already fetching
    if (!nfts || nfts.length === 0 || fetchInProgress.current) return;

    const fetchPricingData = async () => {
      // Generate cache key for this set of NFTs
      const cacheKey = generateCacheKey(nfts);
      if (!cacheKey) return;

      // Check if we have cached data that's still valid
      const cachedData = pricingCache.current.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
        console.log('Using cached pricing data');
        setPricingData(cachedData.data);
        return;
      }

      // Set loading state
      setIsLoadingPrices(true);
      setError(null);

      // Set fetch in progress flag to prevent duplicate calls
      fetchInProgress.current = true;

      try {
        // Prepare the NFTs for bulk pricing request
        const nftItems = nfts.map(nft => ({
          contract_address: nft.contractAddress,
          token_id: nft.tokenId
        }));

        console.log(`Fetching pricing data for ${nftItems.length} NFTs`);

        // Call the NFTGo API for bulk pricing with pagination
        // The updated getBulkNFTPricing function will automatically handle batching
        const pricingResponse = await NFTGo.getBulkNFTPricing(nftItems, false, 50);

        if (!pricingResponse || !pricingResponse.items || !Array.isArray(pricingResponse.items)) {
          throw new Error('Invalid response from pricing API');
        }

        console.log(`Received pricing data for ${pricingResponse.items.length} NFTs`);

        // Map the response to our pricing data structure
        const newPricingData: NFTPricing[] = nfts.map(nft => {
          // Find the corresponding pricing data
          const pricing = pricingResponse.items.find(
            (item: any) =>
              item.contract_address?.toLowerCase() === nft.contractAddress.toLowerCase() &&
              item.token_id === nft.tokenId
          );

          if (!pricing) {
            return {
              nft,
              floorPrice: null,
              estimatedPrice: null,
              priceRatio: null
            };
          }

          const floorPrice = pricing.floor?.value || null;
          const estimatedPrice = pricing.estimated_price?.value || null;

          // Calculate ratio if both values exist
          const priceRatio = (floorPrice && estimatedPrice)
            ? estimatedPrice / floorPrice
            : null;

          return {
            nft,
            floorPrice,
            estimatedPrice,
            priceRatio
          };
        });

        // Update state with the new data
        setPricingData(newPricingData);

        // Cache the result
        pricingCache.current.set(cacheKey, {
          data: newPricingData,
          timestamp: Date.now()
        });

        console.log('Pricing data fetched and cached successfully');
      } catch (err) {
        console.error('Error fetching pricing data:', err);

        // Check if this is a pricing API error and provide user-friendly message
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pricing data';
        if (errorMessage.includes('NFTGo bulk pricing API error') ||
            errorMessage.includes('500') ||
            errorMessage.includes('All retry attempts failed')) {
          setError('Unable to fetch prices... Please try again later.');
        } else {
          setError(errorMessage);
        }
      } finally {
        setIsLoadingPrices(false);
        fetchInProgress.current = false;
      }
    };

    fetchPricingData();
  }, [nfts, CACHE_TTL]);

  // Handle sorting with animation
  const handleSortChange = (descriptor: any) => {
    if (isChangingPage) return;

    // Set loading state
    setIsChangingPage(true);

    // Use setTimeout to allow the loading animation to render
    setTimeout(() => {
      setSortDescriptor({
        column: descriptor.column as string,
        direction: descriptor.direction as "ascending" | "descending"
      });

      // Reset loading state after a short delay
      setTimeout(() => {
        setIsChangingPage(false);
      }, 300);
    }, 100);
  };

  // Handle page change with animation and loading state
  const handlePageChange = (newPage: number) => {
    if (newPage === page || isChangingPage || isLoadingPrices) return;

    // Set loading state
    setIsChangingPage(true);

    // Use setTimeout to allow the loading animation to render
    setTimeout(() => {
      setPage(newPage);

      // Reset loading state after a short delay to show the animation
      setTimeout(() => {
        setIsChangingPage(false);
      }, 300);
    }, 100);
  };

  // Handle rows per page change with loading state
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isChangingPage || isLoadingPrices) return;

    const newRowsPerPage = Number(e.target.value);

    // Set loading state
    setIsChangingPage(true);

    // Use setTimeout to allow the loading animation to render
    setTimeout(() => {
      setRowsPerPage(newRowsPerPage);
      // Reset to page 1 when changing rows per page
      setPage(1);

      // Reset loading state after a short delay
      setTimeout(() => {
        setIsChangingPage(false);
      }, 300);
    }, 100);
  };

  // Render NFT cell content
  const renderNFTCell = (nft: NFT) => (
    <div className="flex items-center space-x-3">
      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md relative group">
        {nft.image || nft.collection?.image ? (
          <>
            <NFTMedia
              src={nft.image || nft.collection?.image}
              alt={nft.name || 'NFT Media'}
              className="h-full w-full object-cover"
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
              <span className="text-white text-xs font-medium">View</span>
            </a>
          </>
        ) : (
          <div className="h-full w-full bg-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-500">No Image</span>
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="font-medium">{nft.name}</div>
          <div className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md text-white text-xs font-mono shadow-sm ml-2 flex items-center gap-0.5">
            <span className="opacity-70">#</span>
            <span>{nft.tokenId}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {nft.collection?.name || 'Unknown Collection'}
          </div>
          <div className="flex space-x-1">
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
        </div>
      </div>
    </div>
  );

  // Render price cell content
  const renderPriceCell = (value: number | null) => {
    return value !== null ? (
      <div className="font-medium">{value.toFixed(4)} ETH</div>
    ) : (
      <div className="text-zinc-400">N/A</div>
    );
  };

  // Render price ratio cell content
  const renderPriceRatioCell = (value: number | null) => {
    if (value === null) return <div className="text-zinc-400">N/A</div>;

    // Determine color based on ratio (above or below floor price)
    const color = value > 1 ? 'text-green-600' : 'text-red-600';
    const percentage = ((value - 1) * 100).toFixed(2);
    const sign = value > 1 ? '+' : '';

    return (
      <div className={`font-medium ${color}`}>
        {sign}{percentage}%
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-lg">Loading NFTs...</span>
      </div>
    );
  }

  // Empty state
  if (!nfts || nfts.length === 0) {
    return (
      <div className="text-center p-8 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
        <p className="text-zinc-500 dark:text-zinc-400">
          No NFTs found in your wallet.
        </p>
      </div>
    );
  }

  // Pagination component with animation specifically for the pricing table
  const PricingTablePagination = () => {
    if (!processedData.showPagination) return null;

    // Determine if pagination controls should be disabled
    const isPaginationDisabled = isChangingPage || isLoadingPrices;

    return (
      <motion.div
        className="flex flex-col w-full mt-4 bg-white dark:bg-zinc-900 rounded-lg p-3 shadow-sm border border-zinc-100 dark:border-zinc-800"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {isPaginationDisabled && (
              <div className="flex items-center space-x-1">
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                <span className="text-xs text-blue-500">
                  {isLoadingPrices ? "Loading prices..." : "Updating..."}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={rowsPerPage}
              onChange={handleRowsPerPageChange}
              className={`rounded border border-zinc-300 dark:border-zinc-700 p-1 bg-white dark:bg-zinc-800 text-xs ${isPaginationDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isPaginationDisabled}
            >
              {[5, 10, 20, 50].map(size => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-center">
          {isPaginationDisabled ? (
            <div className="flex items-center justify-center h-10 w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {isLoadingPrices ? "Fetching price data..." : "Updating price table..."}
              </span>
            </div>
          ) : (
            <Pagination
              showControls
              showShadow
              color="primary"
              page={page}
              total={processedData.totalPages}
              onChange={handlePageChange}
              isDisabled={isPaginationDisabled}
              classNames={{
                wrapper: "gap-1 overflow-visible",
                item: "transition-all duration-200 ease-in-out bg-white dark:bg-zinc-800",
                cursor: "bg-blue-500 shadow-lg shadow-blue-200 dark:shadow-blue-900/30"
              }}
            />
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4 mt-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
      {/* Error message */}
      {error && (
        <motion.div
          className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {error}
        </motion.div>
      )}

      {/* HeroUI Table */}
      <motion.div
        animate={{
          opacity: isChangingPage ? 0.7 : 1,
          scale: isChangingPage ? 0.99 : 1
        }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        {/* Page change loading overlay */}
        {isChangingPage && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center rounded-lg">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Updating table...
              </p>
            </motion.div>
          </div>
        )}

        <Table
          aria-label="NFT Pricing Table"
          sortDescriptor={sortDescriptor}
          onSortChange={handleSortChange}
          classNames={{
            wrapper: "min-h-[222px] bg-white dark:bg-zinc-900 rounded-lg shadow",
            th: "bg-zinc-50 dark:bg-zinc-800 text-sm font-medium",
            td: "py-3",
          }}
        >
          <TableHeader>
            <TableColumn key="nft" allowsSorting>NFT</TableColumn>
            <TableColumn key="floorPrice" allowsSorting>Floor Price</TableColumn>
            <TableColumn key="estimatedPrice" allowsSorting>Estimated Price</TableColumn>
            <TableColumn key="priceRatio" allowsSorting>Price Ratio</TableColumn>
          </TableHeader>
          <TableBody
            items={processedData.paginatedItems}
            emptyContent={
              error ? (
                <div className="flex flex-col items-center py-8">
                  <p className="text-red-500 dark:text-red-400 text-center">
                    {error}
                  </p>
                </div>
              ) : (
                "No NFT pricing data available"
              )
            }
            isLoading={isLoadingPrices}
            loadingContent={
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-2" />
                <p className="text-zinc-500 dark:text-zinc-400">
                  Fetching pricing data...
                </p>
              </div>
            }
          >
          {(item) => (
            <TableRow
              key={`${item.nft.contractAddress}:${item.nft.tokenId}`}
              className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <TableCell>{renderNFTCell(item.nft)}</TableCell>
              <TableCell>{renderPriceCell(item.floorPrice)}</TableCell>
              <TableCell>{renderPriceCell(item.estimatedPrice)}</TableCell>
              <TableCell>{renderPriceRatioCell(item.priceRatio)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </motion.div>

      {/* Add the dedicated pricing table pagination */}
      {processedData.showPagination && <PricingTablePagination />}
    </div>
  );
}
