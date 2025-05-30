'use client';

import React, { useEffect, useState, useRef } from 'react';
// Removed Next.js Image import
import { Button } from '@/components/ui/Button';
import NFTGrid from '@/components/nft/NFTGrid';

import ConnectWalletMessage from '@/components/wallet/ConnectWalletMessage';
// Import the NFTContext
import { useNFTs } from '@/context/NFTContext';
import { RefreshCw, Loader2, Check, X, Tag, ArrowUpDown } from 'lucide-react';

import CustomEditNFTModal from '@/components/marketplace/CustomEditNFTModal';
import NFTPricingTable from '@/components/nft/NFTPricingTable';

import StateMonitor from '@/components/debug/StateMonitor';
import { ConnectButton } from '@rainbow-me/rainbowkit'; // Import RainbowKit ConnectButton
import { useAccount, useSwitchChain } from 'wagmi'; // Import wagmi hooks
import BulkListingModal from '@/components/marketplace/BulkListingModal';
import SelectionSidebar from '@/components/nft/SelectionSidebar';
import { motion } from 'framer-motion';
import { devLog } from '@/lib/dev-utils';
import Web3MarketModal from '@/components/ui/Web3MarketModal';
import { useWeb3MarketModal } from '@/hooks/useWeb3MarketModal';
import Footer from '@/components/layout/Footer';
import { Info } from 'lucide-react';

export default function Home() {
  // Replace old context hooks with wagmi hooks
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const { isPending: isSwitchingNetwork } = useSwitchChain();

  // Web3Market promotional modal
  const { isModalOpen, closeModal, openModal } = useWeb3MarketModal();

  // Use the NFTContext to get NFT data
  const {
    nfts,
    displayedNFTs,
    setDisplayedNFTs,
    isLoading,
    refreshNFTs,
    refreshUserListings,
    isNFTListed,
    // Pagination
    handlePageChange,
    // Modal state and functions
    selectedNFT,
    isEditModalOpen,
    closeEditModal,
    // Multi-selection functionality
    selectedNFTs,
    selectAllNFTs,
    deselectAllNFTs,
    hasSelectedNFTs
  } = useNFTs();
  const [activeFilter, setActiveFilter] = useState<'all' | 'listed' | 'unlisted'>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [isBulkListingModalOpen, setIsBulkListingModalOpen] = useState(false);

  // We're using the NFTContext for all NFT-related functionality

  // Use a ref to track if we've already done the initial refresh
  const initialRefreshDone = useRef(false);

  // Add an effect to refresh NFTs and listings when the component mounts and the user is connected
  useEffect(() => {
    if (isConnected && !isLoading && !initialRefreshDone.current) {
      devLog('Auto-refreshing NFTs and listings on component mount (one-time)');
      initialRefreshDone.current = true;

      // First refresh NFTs
      const fetchData = async () => {
        await refreshNFTs();
        // Then refresh user listings to ensure they're properly tracked
        await refreshUserListings();
      };

      fetchData();
    }
  }, [isConnected, isLoading, refreshNFTs, refreshUserListings]);

  // Use a ref to track previous filter state to prevent unnecessary updates
  const prevFilterState = useRef({ nfts: nfts, activeFilter: activeFilter });

  // Filter NFTs based on the active filter
  useEffect(() => {
    // Skip filtering if there are no NFTs
    if (nfts.length === 0 && !nfts) {
      setDisplayedNFTs([]);
      return;
    }

    // Check if we need to update based on changes to nfts or activeFilter
    const nftsChanged = nfts !== prevFilterState.current.nfts;
    const filterChanged = activeFilter !== prevFilterState.current.activeFilter;

    if (!nftsChanged && !filterChanged) {
      return; // Skip update if nothing changed
    }

    // Update the ref with current values
    prevFilterState.current = { nfts, activeFilter };

    // Filter NFTs based on the active filter
    let filteredNfts: typeof nfts = [];

    // Don't filter out spam NFTs
    if (activeFilter === 'all') {
      filteredNfts = nfts;
    } else if (activeFilter === 'listed') {
      filteredNfts = nfts.filter(nft => isNFTListed(nft));
    } else if (activeFilter === 'unlisted') {
      filteredNfts = nfts.filter(nft => !isNFTListed(nft));
    }

    // Update the displayed NFTs - only show the first page when filter changes
    const itemsPerPage = 8; // Match the value in NFTContext
    setDisplayedNFTs(filteredNfts.slice(0, itemsPerPage));

    // Reset to first page when filter changes
    if (handlePageChange) {
      handlePageChange(1);
    }
  }, [nfts, activeFilter, isNFTListed, setDisplayedNFTs, handlePageChange]);

  return (
    <div className="min-h-screen p-8 pb-20 gap-8 sm:p-10 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            Your NFT Portfolio
          </h1>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={openModal}
              className="flex items-center gap-2 text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
            >
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">About</span>
            </Button>
            {/* Use RainbowKit ConnectButton */}
            <ConnectButton />
          </div>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          View, manage, and sell your NFT collection across multiple marketplaces
        </p>

        {isSwitchingNetwork ? (
          <div className="flex flex-col items-center justify-center p-8 text-center h-[50vh]">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Switching Networks</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              Please wait while we connect to the new network. Your NFTs will load automatically once connected.
            </p>
          </div>
        ) : !isConnected ? (
          <ConnectWalletMessage />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Your Collection</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {nfts.length} NFTs in your wallet
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshUserListings} // Refresh listings
                    disabled={isLoading || isConnecting || isReconnecting}
                    className="p-2"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                      style={{ animationDuration: '1s' }}
                    />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activeFilter === 'all' ? 'gradient' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('all')}
                  className={`${activeFilter === 'all' ? 'bg-blue-500 text-white hover:bg-blue-600' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                >
                  All
                </Button>
                <Button
                  variant={activeFilter === 'listed' ? 'gradient' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('listed')}
                  className={`${activeFilter === 'listed' ? 'bg-green-500 text-white hover:bg-green-600' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                >
                  Listed
                </Button>
                <Button
                  variant={activeFilter === 'unlisted' ? 'gradient' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('unlisted')}
                  className={`${activeFilter === 'unlisted' ? 'bg-purple-500 text-white hover:bg-purple-600' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                >
                  Unlisted
                </Button>

                {/* Selection mode toggle */}
                <Button
                  variant={selectionMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    if (selectionMode) {
                      deselectAllNFTs(); // Deselect all when exiting selection mode
                    }
                  }}
                  className="ml-2"
                >
                  {selectionMode ? 'Exit Selection' : 'Select Multiple'}
                </Button>

                {/* Bulk actions */}
                {selectionMode && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllNFTs}
                      disabled={displayedNFTs.length === 0}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deselectAllNFTs}
                      disabled={!hasSelectedNFTs}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Deselect All
                    </Button>
                    {hasSelectedNFTs && (
                      <Button
                        variant="gradient"
                        size="sm"
                        onClick={() => setIsBulkListingModalOpen(true)}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                      >
                        <Tag className="h-4 w-4 mr-1" />
                        List {selectedNFTs.length} NFTs
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            <NFTGrid
              nfts={displayedNFTs}
              isLoading={isLoading || isConnecting || isReconnecting}
              emptyText={
                isLoading || isConnecting || isReconnecting ? "Loading NFTs..." :
                  activeFilter === 'all' ? "No NFTs found in your wallet. Purchase some NFTs to get started!" :
                    activeFilter === 'listed' ? "No listed NFTs found. List some NFTs to get started!" :
                      "No unlisted NFTs found. All your NFTs are currently listed!"
              }
              selectionMode={selectionMode}
            />

            {/* NFT Pricing Table */}
            {nfts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-12"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">NFT Price Estimates</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Compare estimated prices and marketplace fees for your NFTs
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    Sort by Value
                  </Button>
                </div>
                {/* Pass all NFTs to the pricing table, not just displayed ones */}
                <NFTPricingTable nfts={nfts} />
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* Keep StateMonitor for debugging */}
      <StateMonitor />

      {/* Bulk Listing Modal */}
      <BulkListingModal
        isOpen={isBulkListingModalOpen}
        onClose={() => setIsBulkListingModalOpen(false)}
        onSuccess={() => {
          setIsBulkListingModalOpen(false);
          refreshNFTs();
        }}
      />

      {/* Selection Sidebar */}
      <SelectionSidebar
        onListClick={() => setIsBulkListingModalOpen(true)}
        isBulkListModalOpen={isBulkListingModalOpen}
      />

      {/* Edit NFT Modal */}
      <CustomEditNFTModal
        nft={selectedNFT}
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        onSuccess={() => {
          refreshNFTs();
          refreshUserListings();
        }}
      />

      {/* Web3Market Promotional Modal */}
      <Web3MarketModal
        isOpen={isModalOpen}
        onClose={closeModal}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
