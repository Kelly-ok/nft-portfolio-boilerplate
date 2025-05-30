import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { MarketplaceListing, NFT } from '@/types';
import { getOrdersByMaker, getAllOrdersByMaker, getAllOrdersByMakerProgressive } from '@/services/marketplace/nftgo';

// Shared static variables across all hook instances
const GLOBAL_STATE = {
  lastFetchTime: 0,
  isRefreshing: false,
  pendingRefresh: false,
  refreshPromise: null as Promise<void> | null,
};

/**
 * Hook to fetch and manage NFT listings for a wallet address
 * @param walletAddress Optional wallet address to fetch listings for (defaults to connected wallet)
 * @param nfts Optional array of NFTs to match with listings
 * @returns Object containing listings and loading state
 */
export function useNFTListings(walletAddress?: string, nfts?: NFT[]) {
  const { address } = useAccount();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the provided wallet address or the connected wallet address
  const targetAddress = walletAddress || address;

  // Use a ref to track the timeout for this component instance
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if the component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  // Track the last fetched address to prevent duplicate fetches
  const lastFetchedAddress = useRef<string | null>(null);

  // Fetch listings when the component mounts or the address changes
  useEffect(() => {
    if (!targetAddress) return;

    // Set mounted flag
    isMounted.current = true;

    // Skip if we've already fetched for this address and NFTs haven't changed
    if (lastFetchedAddress.current === targetAddress && listings.length > 0) {
      return;
    }

    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    const fetchListings = async () => {
      // Skip if component unmounted
      if (!isMounted.current) return;

      setIsLoading(true);
      setError(null);

      try {
        // Check if we need to wait before making another API call (rate limiting)
        const now = Date.now();
        const timeSinceLastFetch = now - GLOBAL_STATE.lastFetchTime;
        const minTimeBetweenFetches = 300000; // 5 minutes minimum between fetches

        // If another component is already refreshing, don't duplicate the effort
        if (GLOBAL_STATE.isRefreshing) {
          console.log('Another component is already refreshing listings, waiting for that to complete');
          return;
        }

        if (timeSinceLastFetch < minTimeBetweenFetches) {
          // Wait before making the API call
          const waitTime = minTimeBetweenFetches - timeSinceLastFetch;
          console.log(`Rate limiting: waiting ${waitTime}ms before fetching listings`);

          // Set a timeout to fetch after the wait time
          fetchTimeoutRef.current = setTimeout(() => {
            if (isMounted.current) {
              fetchListings();
            }
          }, waitTime);

          return;
        }

        // Update the last fetch time and address
        GLOBAL_STATE.lastFetchTime = now;
        lastFetchedAddress.current = targetAddress;
        GLOBAL_STATE.isRefreshing = true;

        // Fetch listings from all marketplaces
        const allListings = await getOrdersByMaker(targetAddress);
        console.log(`Found ${allListings.length} listings for ${targetAddress}`);

        // Skip further processing if component unmounted
        if (!isMounted.current) return;

        // If we have NFTs, match them with the listings
        if (nfts && nfts.length > 0) {
          const matchedListings = allListings.map(listing => {
            const matchedNFT = nfts.find(
              nft =>
                nft.contractAddress.toLowerCase() === listing.contractAddress.toLowerCase() &&
                nft.tokenId === listing.tokenId
            );

            if (matchedNFT) {
              return {
                ...listing,
                nft: matchedNFT
              };
            }

            return listing;
          });

          setListings(matchedListings);
        } else {
          setListings(allListings);
        }
      } catch (err) {
        // Skip error handling if component unmounted
        if (!isMounted.current) return;

        console.error('Error fetching NFT listings:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch listings');
      } finally {
        // Reset the global refreshing state
        GLOBAL_STATE.isRefreshing = false;

        // Skip state update if component unmounted
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    fetchListings();

    // Clean up the timeout on unmount
    return () => {
      isMounted.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [targetAddress, listings.length, nfts]);

  /**
   * Get listings for a specific NFT
   * @param nft The NFT to get listings for
   * @returns Array of listings for the NFT
   */
  const getListingsForNFT = (nft: NFT): MarketplaceListing[] => {
    return listings.filter(
      listing =>
        listing.contractAddress.toLowerCase() === nft.contractAddress.toLowerCase() &&
        listing.tokenId === nft.tokenId
    );
  };

  /**
   * Check if an NFT has active listings
   * @param nft The NFT to check
   * @returns Boolean indicating if the NFT has active listings
   */
  const hasListings = (nft: NFT): boolean => {
    return getListingsForNFT(nft).length > 0;
  };

  /**
   * Refresh the listings with rate limiting
   * @param forceRefresh - Optional parameter to bypass rate limiting
   */
  const refreshListings = async (forceRefresh: boolean = false) => {
    if (!targetAddress || !isMounted.current) return;

    // If we already have a refresh in progress, return that promise
    if (GLOBAL_STATE.isRefreshing && GLOBAL_STATE.refreshPromise) {
      console.log('A refresh is already in progress, returning existing promise');
      return GLOBAL_STATE.refreshPromise;
    }

    // Check if we need to wait before making another API call (rate limiting)
    const now = Date.now();
    const timeSinceLastFetch = now - GLOBAL_STATE.lastFetchTime;
    const minTimeBetweenFetches = 300000; // 5 minutes minimum between fetches

    // Skip rate limiting if forceRefresh is true
    if (!forceRefresh && timeSinceLastFetch < minTimeBetweenFetches) {
      // If we're within the rate limit window, only log once
      if (!GLOBAL_STATE.pendingRefresh) {
        GLOBAL_STATE.pendingRefresh = true;
        console.log(`Rate limiting: next refresh available in ${Math.ceil((minTimeBetweenFetches - timeSinceLastFetch) / 1000)} seconds`);
      }

      // Return a resolved promise to prevent multiple waiting messages
      return Promise.resolve();
    }

    // If forceRefresh is true, log it
    if (forceRefresh) {
      console.log('Force refreshing listings, bypassing rate limiting');
    }

    // Reset pending refresh flag
    GLOBAL_STATE.pendingRefresh = false;

    // Set global refreshing state
    GLOBAL_STATE.isRefreshing = true;

    // Create a new refresh promise
    GLOBAL_STATE.refreshPromise = (async () => {
      try {
        // Update the last fetch time
        GLOBAL_STATE.lastFetchTime = now;
        lastFetchedAddress.current = targetAddress;

        if (isMounted.current) {
          setIsLoading(true);
          setError(null);
        }


        const allListings = await getAllOrdersByMaker(targetAddress);

        // Skip further processing if component unmounted
        if (!isMounted.current) return;

        // If we have NFTs, match them with the listings
        if (nfts && nfts.length > 0) {
          const matchedListings = allListings.map(listing => {
            const matchedNFT = nfts.find(
              nft =>
                nft.contractAddress.toLowerCase() === listing.contractAddress.toLowerCase() &&
                nft.tokenId === listing.tokenId
            );

            if (matchedNFT) {
              return {
                ...listing,
                nft: matchedNFT
              };
            }

            return listing;
          });

          setListings(matchedListings);
        } else {
          setListings(allListings);
        }
      } catch (err) {
        // Skip error handling if component unmounted
        if (!isMounted.current) return;

        console.error('Error refreshing NFT listings:', err);
        setError(err instanceof Error ? err.message : 'Failed to refresh listings');
      } finally {
        // Reset the global refreshing state
        GLOBAL_STATE.isRefreshing = false;
        GLOBAL_STATE.refreshPromise = null;

        // Skip state update if component unmounted
        if (isMounted.current) {
          setIsLoading(false);
        }
      }

      return undefined;
    })();

    return GLOBAL_STATE.refreshPromise;
  };

  return {
    listings,
    isLoading,
    error,
    getListingsForNFT,
    hasListings,
    refreshListings
  };
}
