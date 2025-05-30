'use client';

import React from 'react';
import { NFT } from '@/types';
import NFTCard from './NFTCard';
import { useNFTs } from '@/context/NFTContext';
import { Pagination } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';

interface NFTGridProps {
  nfts: NFT[];
  isLoading?: boolean;
  emptyText?: string;
  onCancelClick?: (nft: NFT) => void;
  onListClick?: (nft: NFT) => void;
  onEditClick?: (nft: NFT) => void;
  selectionMode?: boolean; // Enable multi-selection mode
}

export default React.memo(function NFTGrid({ nfts: propNfts, isLoading = false, emptyText = 'No NFTs found', onCancelClick, onListClick, onEditClick, selectionMode = false }: NFTGridProps) {
  // Use the NFT context for pagination
  const { currentPage, totalPages, handlePageChange, isLoadingMore } = useNFTs();

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array(8)
          .fill(null)
          .map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="aspect-square animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" style={{ animationDuration: '1s' }} />
              </div>
            </div>
          ))}
      </div>
    );
  }

  // Empty state
  if (propNfts.length === 0) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyText}</p>
      </div>
    );
  }

  // NFT grid
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {propNfts.map((nft) => (
          <NFTCard
            key={`${nft.contractAddress}-${nft.tokenId}`}
            nft={nft}
            onCancelClick={onCancelClick}
            onListClick={onListClick}
            onEditClick={onEditClick}
            selectionMode={selectionMode}
          />
        ))}
      </div>

      {/* NFT Grid Pagination */}
      {totalPages > 1 && (
        <AnimatePresence mode="wait">
          <motion.div
            className="flex flex-col w-full mt-6 bg-white dark:bg-zinc-900 rounded-lg p-3 shadow-sm border border-zinc-100 dark:border-zinc-800"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-center mb-2">
              {isLoadingMore && (
                <div className="flex items-center space-x-1">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-purple-500" style={{ animationDuration: '1s' }} />
                  <span className="text-xs text-purple-500">Loading NFTs...</span>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              {isLoadingMore ? (
                <div className="flex items-center justify-center h-10 w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-purple-500 mr-2" style={{ animationDuration: '1s' }} />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Loading NFT collection...</span>
                </div>
              ) : (
               <Pagination
                  total={totalPages}
                  initialPage={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                  showControls
                  showShadow
                  size="lg"
                  isDisabled={isLoadingMore}
                  classNames={{
                    wrapper: "gap-1 overflow-visible",
                    item: "transition-all duration-200 ease-in-out bg-white dark:bg-zinc-800",
                    cursor: "bg-blue-500 shadow-lg shadow-blue-200 dark:shadow-blue-900/30"
                  }}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
});