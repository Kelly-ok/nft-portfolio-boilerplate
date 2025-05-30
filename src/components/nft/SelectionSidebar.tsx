'use client';

import { useState, useEffect, useRef } from 'react';
import { useNFTs } from '@/context/NFTContext';
import { Button } from '@/components/ui/Button';
import { Tag, ChevronLeft, X, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface SelectionSidebarProps {
  onListClick: () => void;
  isBulkListModalOpen?: boolean;
}

export default function SelectionSidebar({ onListClick, isBulkListModalOpen = false }: SelectionSidebarProps) {
  const { selectedNFTs, deselectAllNFTs } = useNFTs();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [showFadeEffect, setShowFadeEffect] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0); // 0 = top, 1 = middle, 2 = bottom
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // No need for a separate NFTs array now

  // Check if we're on mobile and manage body overflow
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkIfMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);

    // Only prevent body scrolling on desktop, not on mobile
    if (selectedNFTs.length > 0 && !isCollapsed && !isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkIfMobile);
      // Restore body scrolling when component unmounts
      document.body.style.overflow = '';
    };
  }, [selectedNFTs.length, isCollapsed, isMobile]);

  // Show scroll hint when there are more than 3 NFTs
  useEffect(() => {
    if (selectedNFTs.length > 3 && isMobile) {
      setShowScrollHint(true);
      // Hide the hint after 3 seconds
      const timer = setTimeout(() => {
        setShowScrollHint(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedNFTs.length, isMobile]);

  // Handle scroll events to control fade effect
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (scrollContainer && selectedNFTs.length > 3) {
      const handleScroll = () => {
        // Check if scrolled to bottom (with a small threshold)
        const isAtBottom =
          Math.abs(scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight) < 20;

        // Calculate scroll position for indicator dots
        const scrollPercentage = scrollContainer.scrollTop / (scrollContainer.scrollHeight - scrollContainer.clientHeight);

        if (isAtBottom || scrollPercentage > 0.7) {
          setScrollPosition(2); // Bottom
        } else if (scrollPercentage > 0.3) {
          setScrollPosition(1); // Middle
        } else {
          setScrollPosition(0); // Top
        }

        // Show fade effect only when not at the bottom
        setShowFadeEffect(!isAtBottom);
      };

      // Initial check
      handleScroll();

      // Add scroll event listener
      scrollContainer.addEventListener('scroll', handleScroll);

      // Cleanup
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [selectedNFTs.length]);

  // Calculate total value if price data is available
  const calculateTotalValue = () => {
    let total = 0;
    selectedNFTs.forEach(nft => {
      if (nft.lastPrice) {
        total += parseFloat(String(nft.lastPrice));
      }
    });
    return total.toFixed(4);
  };

  const totalValue = calculateTotalValue();

  return (
    <AnimatePresence>
      {selectedNFTs.length > 0 && (
        <>
          {/* Close Button - Outside the sidebar at the top - disabled when bulk list modal is open */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              // Prevent toggling when bulk list modal is open
              if (isBulkListModalOpen) return;

              const newCollapsedState = !isCollapsed;
              setIsCollapsed(newCollapsedState);

              // When sidebar is fully collapsed, allow body scrolling (desktop only)
              if (typeof document !== 'undefined' && !isMobile) {
                document.body.style.overflow = newCollapsedState ? '' : 'hidden';
              }
            }}
            disabled={isBulkListModalOpen}
            className={`fixed ${isBulkListModalOpen ? 'z-10 pointer-events-none' : 'z-50'} ${
              isMobile
                ? `${isCollapsed
                    ? 'bottom-0 left-1/2 -translate-x-1/2 rounded-t-lg'
                    : isBulkListModalOpen ? 'top-[20vh] right-2 rounded-full opacity-0' : 'top-2 right-2 rounded-full'}`
                : `${isCollapsed
                    ? 'right-0 top-1/2 -translate-y-1/2 rounded-l-lg'
                    : 'right-80 top-1/2 rounded-l-lg'}`
            } bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-2 shadow-lg ${
              isBulkListModalOpen
                ? 'opacity-0 cursor-not-allowed'
                : 'hover:from-indigo-600 hover:to-purple-600'
            } transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
          >
            {isCollapsed ? (
              isMobile ? <ChevronLeft className="rotate-90 h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />
            ) : (
              isMobile ?  <X className="h-5 w-5" /> : <ChevronLeft className="rotate-180 h-5 w-5" />
            )}
          </motion.button>

          {/* Sidebar Container */}
          <motion.div
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={
              isCollapsed
                ? (isMobile ? { y: 'calc(100% - 40px)' } : { x: '100%' })
                : (isMobile ? { y: isBulkListModalOpen ? '20vh' : 0 } : { x: 0 })
            }
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.3
            }}
            className={`fixed ${isMobile ? 'bottom-0 left-0 right-0' : 'top-0 bottom-0 right-0 w-80'} ${
              isBulkListModalOpen ? 'z-10' : 'z-40'
            }`}
            style={{
              pointerEvents: 'auto',
              overscrollBehavior: 'contain', // Prevent scroll chaining
              height: isMobile ? 'auto' : '100%',
              maxHeight: isMobile ? '50vh' : '100%', // Smaller height on mobile (50% of viewport)
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Sidebar Content - Using flex layout for proper scrolling */}
            <div
              className={`${isMobile ? 'rounded-t-xl' : 'rounded-l-xl'} bg-white dark:bg-zinc-900 shadow-xl border-l border-t border-zinc-200 dark:border-zinc-800 overflow-hidden flex-1 ${
                isBulkListModalOpen ? 'relative' : ''
              }`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
                maxHeight: isMobile ? '50vh' : '100vh'
              }}
            >
              {/* Overlay when modal is open */}
              {isBulkListModalOpen && (
                <div
                  className="absolute inset-0 bg-black/10 dark:bg-black/20 z-5"
                  style={{ pointerEvents: 'none' }}
                ></div>
              )}
              {/* Header - Fixed */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-gradient-to-r from-indigo-500/10 to-purple-500/10 relative z-10">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white mr-2">
                    <span className="text-xs font-bold">{selectedNFTs.length}</span>
                  </div>
                  <h3 className="font-semibold text-lg">Selected NFTs</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={isBulkListModalOpen ? undefined : deselectAllNFTs}
                  disabled={isBulkListModalOpen}
                  className={`text-zinc-500 ${
                    isBulkListModalOpen
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:text-zinc-700 dark:hover:text-zinc-200'
                  } dark:text-zinc-400`}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>

              {/* NFT List - Show 3 NFTs and make scrollable when more */}
              <div className="p-4 overflow-hidden flex-1 relative z-10" style={{
                minHeight: isMobile ? '150px' : 'auto',
                maxHeight: isMobile ? 'calc(50vh - 160px)' : 'auto', // Account for header and footer with smaller height
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Scrollable container with hidden scrollbar */}
                <div
                  ref={scrollContainerRef}
                  className="h-full overflow-y-auto custom-scrollbar scrollbar-hidden"
                  style={{
                    WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
                    touchAction: 'pan-y', // Improve touch handling
                    msOverflowStyle: 'none', // Hide scrollbar on IE/Edge
                    // Fixed height to show exactly 3 items (3 * 64px item height + 2 * 12px gap)
                    height: selectedNFTs.length > 3 ? (isMobile ? '216px' : '216px') : 'auto',
                    maxHeight: selectedNFTs.length > 3 ? (isMobile ? '216px' : '216px') : 'auto',
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  <div className="space-y-3" style={{ paddingBottom: '8px' }}>
                    {selectedNFTs.map((nft, index) => (
                      <div
                        key={`${nft.contractAddress}-${nft.tokenId}-${index}`}
                        className="flex items-center gap-3 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-200 group"
                        style={{ height: '64px' }} // Fixed height for consistent sizing
                      >
                        <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-zinc-200 dark:ring-zinc-700 group-hover:ring-indigo-300 dark:group-hover:ring-indigo-700 transition-all duration-200">
                          <Image
                            src={nft.image || '/images/placeholder-nft.svg'}
                            alt={nft.name || 'NFT'}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">{nft.name}</p>
                          {nft.collection && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{nft.collection.name}</p>
                          )}
                        </div>
                        {nft.lastPrice ? (
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {nft.lastPrice.value} {nft.lastPrice.payment_token.symbol}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              ${nft.lastPrice.usd.toFixed(2)}
                            </p>
                          </div>
                        ) : (
                          <div className="text-right">
                            <p className="text-sm font-medium">Not listed</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subtle fade effect at the bottom to indicate more content - hidden when at bottom */}
                {selectedNFTs.length > 3 && (
                  <div
                    className="absolute bottom-7 left-0 right-0 h-16 pointer-events-none"
                    style={{
                      background: `linear-gradient(to bottom, transparent 0%, ${
                        typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
                          ? 'rgb(24, 24, 27)' // dark:bg-zinc-900
                          : 'white'
                      } 100%)`,
                      zIndex: 2,
                      transition: 'opacity 0.2s ease-in-out',
                      opacity: showFadeEffect ? 1 : 0,
                      visibility: showFadeEffect ? 'visible' : 'hidden'
                    }}
                  ></div>
                )}

                {/* Subtle professional scroll indicator with animation hint */}
                {selectedNFTs.length > 3 && (
                  <div className="flex justify-center mt-1 mb-1 relative">
                    <div className="flex space-x-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                        scrollPosition === 0
                          ? 'bg-indigo-500 dark:bg-indigo-400'
                          : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}></div>
                      <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                        scrollPosition === 1
                          ? 'bg-indigo-500 dark:bg-indigo-400'
                          : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}></div>
                      <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                        scrollPosition === 2
                          ? 'bg-indigo-500 dark:bg-indigo-400'
                          : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}></div>
                    </div>

                    {/* Scroll hint animation for mobile */}
                    {showScrollHint && isMobile && (
                      <motion.div
                        className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-indigo-500 dark:text-indigo-400"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ repeat: 3, duration: 0.8 }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer with Summary and Action Button - Fixed */}
              <div className={`p-4 border-t border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 ${isMobile ? 'pb-8' : ''} relative z-20`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Total Items:</span>
                  <span className="text-sm">{selectedNFTs.length}</span>
                </div>

                {parseFloat(totalValue) > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Estimated Value:</span>
                    <span className="text-sm">{totalValue} ETH</span>
                  </div>
                )}

                <Button
                  variant="gradient"
                  className={`w-full bg-gradient-to-r from-indigo-500 to-purple-500 ${
                    isBulkListModalOpen
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:from-indigo-600 hover:to-purple-600'
                  } text-white ${isMobile ? 'py-5 text-lg' : 'py-3 text-base'} font-medium shadow-lg rounded-lg`}
                  onClick={isBulkListModalOpen ? undefined : onListClick}
                  disabled={isBulkListModalOpen}
                  style={{
                    position: 'relative',
                    zIndex: isBulkListModalOpen ? 5 : 50
                  }}
                >
                  <Tag className={`${isMobile ? 'h-6 w-6' : 'h-5 w-5'} mr-2`} />
                  List {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
