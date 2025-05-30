'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { NFT, MarketplaceListing } from '@/types';
import * as NFTGo from '@/services/marketplace/nftgo';
import * as MarketplaceService from '@/services/marketplace';
import { devLog, devError } from '@/lib/dev-utils';

// Import constants from NFTGo service
const API_BASE_URL = '/api/nftgo';

interface NFTContextType {
    nfts: NFT[];
    isLoading: boolean;
    error: string | null;
    refreshNFTs: () => Promise<void>;
    selectedNFT: NFT | null;

    // Separate modal state management for edit and list
    isEditModalOpen: boolean;
    isListModalOpen: boolean;
    closeEditModal: () => void;
    closeListModal: () => void;
    // Pagination related properties and functions
    displayedNFTs: NFT[];
    setDisplayedNFTs: (nfts: NFT[]) => void;
    hasMoreNFTs: boolean;
    loadMoreNFTs: () => void;
    isLoadingMore: boolean;
    currentPage: number;
    totalPages: number;
    handlePageChange: (page: number) => void;
    // Check if an NFT is already listed
    isNFTListed: (nft: NFT) => boolean;
    // Get listing information for an NFT
    getListingInfo: (nft: NFT) => MarketplaceListing | null;
    // Get all listings for an NFT (multiple marketplaces)
    getListingsForNFT: (nft: NFT) => MarketplaceListing[];
    // Get marketplaces where an NFT is listed
    getListedMarketplaces: (nft: NFT) => string[];
    // Clear cached listings data
    clearListingsCache: (walletAddress?: string) => void;
    // Force refresh listings (bypasses cache)
    forceRefreshListings: () => Promise<void>;
    openListModal: (nft: NFT) => void;
    openEditModal: (nft: NFT) => void;
    // User listings pagination
    fetchNextUserListingsPage: () => void;
    hasMoreUserListings: boolean | undefined;
    // Refresh user listings data
    refreshUserListings: () => Promise<void>;
    // Bids related functions
    getBidsForNFT: (nft: NFT) => any[];
    fetchOffersForNFT: (nft: NFT) => Promise<any[]>;
    hasOffersForNFT: (nft: NFT) => boolean;
    getTopOfferForNFT: (nft: NFT) => any | null;
    // Multi-selection functionality
    selectedNFTs: NFT[];
    toggleNFTSelection: (nft: NFT) => void;
    selectAllNFTs: () => void;
    deselectAllNFTs: () => void;
    hasSelectedNFTs: boolean;
    // Bulk listing functionality
    createBulkListing: (price: string, marketplaces: string[], duration: number) => Promise<any>;
}

const NFTContext = createContext<NFTContextType>({
    nfts: [],
    isLoading: false,
    error: null,
    refreshNFTs: async () => { },
    selectedNFT: null,
    // Separate modal state management for edit and list
    isEditModalOpen: false,
    isListModalOpen: false,
    closeEditModal: () => { },
    closeListModal: () => { },
    // Pagination related properties and functions
    displayedNFTs: [],
    setDisplayedNFTs: () => { },
    hasMoreNFTs: false,
    loadMoreNFTs: () => { },
    isLoadingMore: false,
    currentPage: 1,
    totalPages: 1,
    handlePageChange: () => { },
    openListModal: () => { },
    openEditModal: () => { },
    // Listing related functions
    isNFTListed: () => false,
    getListingInfo: () => null,
    getListingsForNFT: () => [],
    getListedMarketplaces: () => [],
    clearListingsCache: () => {},
    forceRefreshListings: async () => {},
    // User listings pagination
    fetchNextUserListingsPage: () => { },
    hasMoreUserListings: undefined,
    // Refresh user listings data
    refreshUserListings: async () => { },
    // Bids related functions
    getBidsForNFT: () => [],
    fetchOffersForNFT: async () => [],
    hasOffersForNFT: () => false,
    getTopOfferForNFT: () => null,
    // Multi-selection functionality
    selectedNFTs: [],
    toggleNFTSelection: () => { },
    selectAllNFTs: () => { },
    deselectAllNFTs: () => { },
    hasSelectedNFTs: false,
    // Bulk listing functionality
    createBulkListing: async () => { }
});

export const useNFTs = () => useContext(NFTContext);

export const NFTProvider = ({ children }: { children: ReactNode }) => {
    const { address, isConnected, chainId, chain } = useAccount();

    const chainIdMap = useMemo(() => ({
        'Ethereum': 1,
        'BNB Smart Chain': 38,
        'Polygon': 89
    }), []);

    const mappedChainId = chain?.name ? chainIdMap[chain.name as keyof typeof chainIdMap] : 1;
    const [nfts, setNfts] = useState<NFT[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isListModalOpen, setIsListModalOpen] = useState(false);

    // Pagination related state
    const [displayedNFTs, setDisplayedNFTs] = useState<NFT[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const itemsPerPage = 8; // Show 8 NFTs per page (matches the grid columns)
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [totalPages, setTotalPages] = useState(1);

    // Multi-selection related state
    const [selectedNFTs, setSelectedNFTs] = useState<NFT[]>([]);

    // State to store listings fetched from NFTGo
    const [nftGoListings, setNftGoListings] = useState<MarketplaceListing[]>([]);

    // State for loading states (simplified without ReservoirKit)
    // Note: isLoading is already defined above for the main loading state


    // Add refs to track refresh state
    const lastRefreshTime = useRef<number>(0);
    const isLoadingRef = useRef<boolean>(false);
    const REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refreshes

    // Update the ref whenever isLoading changes
    useEffect(() => {
        isLoadingRef.current = isLoading;
    }, [isLoading]);

    const refreshNFTs = useCallback(async () => {
        // Prevent refreshing if we're already loading
        if (isLoadingRef.current) {
            return;
        }

        // Prevent refreshing too frequently
        const now = Date.now();
        if (now - lastRefreshTime.current < REFRESH_COOLDOWN) {
            return;
        }

        // Update last refresh time
        lastRefreshTime.current = now;

        // Check if we have a valid address
        if (!address) {
            devLog('No wallet connected, clearing NFTs');
            setNfts([]);
            setDisplayedNFTs([]);
            return;
        }

        devLog(`Using connected wallet: ${address} for NFT fetching`);

        // Set loading state
        setIsLoading(true);
        setError(null);

        try {
            // Use the marketplace service to fetch NFTs with comparison logic
            // This will fetch from NFTGo and compare with Moralis to filter spam
            devLog('Fetching NFTs with comparison logic...');

            // Always use Ethereum (chainId 1)
            let fetchedNFTs: NFT[] = [];
            try {
                // Make sure address is defined before calling the service
                if (address) {
                    fetchedNFTs = await MarketplaceService.getNFTsByWallet(address, 1);
                    devLog(`Successfully fetched ${fetchedNFTs.length} NFTs for wallet: ${address}`);
                } else {
                    devError('No wallet address provided for fetching NFTs');
                }
            } catch (fetchError) {
                devError('Error fetching NFTs:', fetchError);
                // Keep fetchedNFTs as empty array
            }

            if (fetchedNFTs && Array.isArray(fetchedNFTs)) {
                if (fetchedNFTs.length > 0) {
                    // Store the NFTs in state
                    setNfts(fetchedNFTs);

                    // Reset pagination
                    setCurrentPage(1);
                    setDisplayedNFTs(fetchedNFTs.slice(0, itemsPerPage));

                    // For pagination with NFTGo, we need to get the next cursor
                    // This is a simplified approach - in a real implementation,
                    // we would need to handle the cursor from the NFTGo response

                    devLog(`Using connected wallet: ${address} for pagination cursor fetch`);

                    const nftgoResponse = await fetch(
                        `${API_BASE_URL}/nfts?address=${address}&limit=50&sort_by=receivedTime&asc=false`,
                        {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json',
                            },
                        }
                    );

                    if (nftgoResponse.ok) {
                        const data = await nftgoResponse.json();
                        setNextCursor(data.next_cursor || null);
                    } else {
                        devLog('Failed to get pagination cursor');
                        setNextCursor(null);
                    }
                } else {
                    devLog('No NFTs found with comparison logic, trying direct fetch');

                    try {
                        devLog(`Using connected wallet: ${address} for direct NFT fetch`);

                        // Try to fetch NFTs directly from NFTGo without comparison
                        const directNFTGoResponse = await fetch(
                            `${API_BASE_URL}/nfts?address=${address}&limit=50&sort_by=receivedTime&asc=false`,
                            {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json',
                                },
                            }
                        );

                        if (directNFTGoResponse.ok) {
                            const data = await directNFTGoResponse.json();

                            if (data.nfts && data.nfts.length > 0) {
                                // Map NFTGo API response to our NFT format
                                const directNFTs = data.nfts.map((nft: any) => ({
                                    id: `${nft.contract_address}:${nft.token_id}`,
                                    name: nft.name || `#${nft.token_id}`,
                                    description: nft.description || '',
                                    image: nft.image || '',
                                    tokenId: nft.token_id,
                                    contractAddress: nft.contract_address,
                                    owner: address,
                                    collection: {
                                        name: nft.collection_name || 'Unknown Collection',
                                        slug: nft.collection_slug || '',
                                        opensea_slug: nft.collection_opensea_slug || ''
                                    },
                                    attributes: Array.isArray(nft.traits)
                                        ? nft.traits.map((trait: any) => ({
                                            trait_type: trait.type,
                                            value: trait.value,
                                            rarity_percentage: trait.percentage
                                        }))
                                        : [],
                                    isSpam: nft.rarity?.suspicious || false
                                })).filter((nft: NFT) => !nft.isSpam);

                                devLog(`Fetched ${directNFTs.length} NFTs directly from NFTGo`);

                                // Store the NFTs in state
                                setNfts(directNFTs);

                                // Reset pagination
                                setCurrentPage(1);
                                setDisplayedNFTs(directNFTs.slice(0, itemsPerPage));
                                setNextCursor(data.next_cursor || null);

                                return; // Exit early since we've handled the NFTs
                            }
                        }
                    } catch (directError) {
                        devError('Error fetching NFTs directly:', directError);
                    }

                    // If we get here, both approaches failed
                    devLog('All NFT fetch methods failed');
                    setNfts([]);
                    setDisplayedNFTs([]);
                    setNextCursor(null);
                }
            } else {
                devLog('Invalid response from comparison logic');
                setNfts([]);
                setDisplayedNFTs([]);
                setNextCursor(null);
            }
        } catch (err) {
            devError('Error fetching NFTs with comparison logic:', err);
            setError('Failed to load your NFTs. Please try again later.');

            // No fallback available
            devError('All NFT fetch methods failed');
        } finally {
            setIsLoading(false);
        }
    }, [address, itemsPerPage]);

    // Use a ref to track if we've already loaded NFTs to prevent unnecessary reloads
    const initialLoadDone = useRef(false);

    // Track the last address we fetched NFTs for to prevent duplicate fetches
    const lastFetchedAddress = useRef<string | null>(null);

    // Function to refresh user listings data with progressive loading
    const refreshUserListings = useCallback(async (forceRefresh: boolean = false) => {
        // Prevent multiple simultaneous refresh calls
        const wasAlreadyLoading = isLoading;
        if (!wasAlreadyLoading) {
            setIsLoading(true);
        }

        try {
            devLog(`Using connected wallet: ${address} for refreshing listings (forceRefresh: ${forceRefresh})`);

            // Refresh NFTGo listings if we have an address
            if (address) {
                try {
                    // Use progressive loading to show cached data immediately and update incrementally
                    const freshListings = await NFTGo.getAllOrdersByMakerProgressive(
                        address,
                        (marketplace, listings, isComplete, allListings) => {
                            console.log(`Progressive update from ${marketplace}: ${listings.length} listings, complete: ${isComplete}, total: ${allListings.length}`);

                            // Update listings state with each marketplace completion
                            setNftGoListings([...allListings]);

                            // If this is the final update, we can perform any cleanup
                            if (isComplete) {
                                console.log('All marketplaces completed, final listings count:', allListings.length);
                            }
                        },
                        3, // retryCount
                        1000, // initialDelay
                        forceRefresh
                    );

                    console.log('Final refreshed NFTGo listings from all marketplaces:', {
                        count: freshListings.length,
                        listings: freshListings.map(l => ({
                            id: l.id,
                            contractAddress: l.contractAddress,
                            tokenId: l.tokenId,
                            marketplace: l.marketplace,
                            originalMarketplace: l.originalMarketplace,
                            status: l.status,
                            price: l.price,
                            maker: l.maker
                        }))
                    });

                    // Final update to ensure we have the complete data
                    setNftGoListings(freshListings);

                    // Log success for debugging
                    console.log(`Successfully updated NFTGo listings state with ${freshListings.length} listings`);
                } catch (nftgoError) {
                    devError('Error refreshing NFTGo listings:', nftgoError);
                    // Clear listings on error to prevent stale data
                    setNftGoListings([]);
                }
            } else {
                devError('No wallet address provided for refreshing listings');
                // Clear listings when no address
                setNftGoListings([]);
            }

            // Note: We don't automatically refresh NFTs anymore
            // This should be done explicitly by the caller if needed
        } catch (error) {
            devError('Error in refreshUserListings:', error);
            // Clear listings on error
            setNftGoListings([]);
        } finally {
            // Only reset loading state if we set it
            if (!wasAlreadyLoading) {
                setIsLoading(false);
            }
        }
    }, [address, isLoading]);

    // Initial setup when wallet connects - but don't auto-fetch NFTs
    useEffect(() => {
        // Skip if we're already loading
        if (isLoading) return;

        // Only process if connected and address is available
        if (isConnected && address) {
            // Just update the reference to the current address
            // but don't automatically fetch NFTs
            if (lastFetchedAddress.current !== address) {
                console.log('Wallet connected or changed, fetching listings...');
                lastFetchedAddress.current = address;

                // Fetch listings when wallet connects or changes
                refreshUserListings();
            }
        } else {
            // Reset state when disconnected
            setNfts([]);
            setDisplayedNFTs([]);
            setNftGoListings([]); // Clear listings when disconnected
            initialLoadDone.current = false;
            lastFetchedAddress.current = null;
        }

        // Reset the ref when wallet changes
        return () => {
            if (address === undefined) {
                initialLoadDone.current = false;
                lastFetchedAddress.current = null;
            }
        };
    }, [address, isConnected, isLoading, refreshUserListings]);

    // Periodic refresh of listings to keep them up to date
    useEffect(() => {
        if (!isConnected || !address) return;

        // Set up periodic refresh every 2 minutes
        const intervalId = setInterval(() => {
            console.log('Periodic refresh of NFT listings...');
            refreshUserListings();
        }, 2 * 60 * 1000); // 2 minutes

        // Clean up interval on unmount or when dependencies change
        return () => {
            clearInterval(intervalId);
        };
    }, [address, isConnected, refreshUserListings]);

    // Reset initialLoadDone when chain changes
    useEffect(() => {
        if (mappedChainId && lastFetchedAddress.current) {
            // Only reset if we've already fetched and the chain changed
            initialLoadDone.current = false;
            lastFetchedAddress.current = null;
        }
    }, [mappedChainId]);

    // Function to load more NFTs when scrolling
    const loadMoreNFTs = useCallback(async () => {
        if (isLoadingMore || !nextCursor) return;

        setIsLoadingMore(true);

        try {
            devLog(`Using connected wallet: ${address} for loading more NFTs`);

            // Make sure address is defined before calling the API
            if (!address) {
                devError('No wallet address provided for fetching more NFTs');
                return;
            }

            // Use the getMoreNFTsWithCursor function to fetch the next page of NFTs
            const result = await NFTGo.getMoreNFTsWithCursor(address, nextCursor);

            if (result.nfts.length > 0) {

                // Update the next cursor for future pagination
                setNextCursor(result.nextCursor);

                // Add the new NFTs to both the full list and displayed list
                setNfts(prev => [...prev, ...result.nfts]);
                setDisplayedNFTs(prev => [...prev, ...result.nfts]);

                // Increment the page counter
                setCurrentPage(prev => prev + 1);
            } else {
                // Clear the cursor to indicate we've reached the end
                setNextCursor(null);
            }
        } catch (error) {
            devError('Error loading more NFTs:', error);
            // If there's an error, try the old method as fallback
            if (displayedNFTs.length < nfts.length) {
                const nextPage = currentPage + 1;
                const startIndex = (nextPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const newItems = nfts.slice(startIndex, endIndex);

                setDisplayedNFTs(prev => [...prev, ...newItems]);
                setCurrentPage(nextPage);
            }
        } finally {
            setIsLoadingMore(false);
        }
    }, [address, currentPage, displayedNFTs.length, isLoadingMore, itemsPerPage, nextCursor, nfts]);

    // Remove auto-refresh interval to prevent unnecessary re-renders

    // Separate close functions for edit and list modals
    const closeEditModal = useCallback(() => {
        setIsEditModalOpen(false);
        // Only clear the selected NFT if both specific modals are closed
        if (!isListModalOpen) {
            setTimeout(() => setSelectedNFT(null), 300);
        }
    }, [isListModalOpen]);

    const closeListModal = useCallback(() => {
        setIsListModalOpen(false);
        // Only clear the selected NFT if both specific modals are closed
        if (!isEditModalOpen) {
            setTimeout(() => setSelectedNFT(null), 300);
        }
    }, [isEditModalOpen]);

    // Function to get listing information for an NFT
    // Uses NFTGo listings for marketplace accuracy
    const getListingInfo = useCallback((nft: NFT): MarketplaceListing | null => {
        // Debug: Log the current state (only in development)
        if (process.env.NODE_ENV === 'development') {
            console.log(`getListingInfo called for NFT ${nft.id}`, {
                nftGoListingsCount: nftGoListings.length,
                nftContract: nft.contractAddress,
                nftTokenId: nft.tokenId,
                searchKey: `${nft.contractAddress.toLowerCase()}:${nft.tokenId}`,
                availableListings: nftGoListings.map(l => ({
                    key: `${l.contractAddress.toLowerCase()}:${l.tokenId}`,
                    status: l.status,
                    marketplace: l.marketplace,
                    originalMarketplace: l.originalMarketplace,
                    price: l.price,
                    maker: l.maker
                }))
            });
        }

        // Check NFTGo listings with more detailed matching
        const foundNftGoListing = nftGoListings.find(listing => {
            const contractMatch = listing.contractAddress.toLowerCase() === nft.contractAddress.toLowerCase();
            const tokenMatch = listing.tokenId === nft.tokenId;
            const statusMatch = listing.status === 'active';

            if (process.env.NODE_ENV === 'development') {
                console.log(`Checking listing ${listing.id}:`, {
                    contractMatch,
                    tokenMatch,
                    statusMatch,
                    listingContract: listing.contractAddress.toLowerCase(),
                    nftContract: nft.contractAddress.toLowerCase(),
                    listingTokenId: listing.tokenId,
                    nftTokenId: nft.tokenId,
                    listingStatus: listing.status
                });
            }

            return contractMatch && tokenMatch && statusMatch;
        });

        if (foundNftGoListing) {
            devLog(`Found listing in NFTGo for ${nft.id}:`, foundNftGoListing);
            return foundNftGoListing; // Return the detailed NFTGo listing
        }

        // If not found, return null
        if (process.env.NODE_ENV === 'development') {
            console.log(`No active listing found for NFT ${nft.id}`);
        }
        return null;
    }, [nftGoListings]);

    // Function to get all listings for an NFT (multiple marketplaces)
    const getListingsForNFT = useCallback((nft: NFT): MarketplaceListing[] => {
        const searchKey = `${nft.contractAddress.toLowerCase()}:${nft.tokenId}`;

        const foundListings = nftGoListings.filter(listing => {
            const listingKey = `${listing.contractAddress.toLowerCase()}:${listing.tokenId}`;
            return listingKey === searchKey && listing.status === 'active';
        });

        if (process.env.NODE_ENV === 'development') {
            console.log(`Found ${foundListings.length} listings for NFT ${nft.id}:`, foundListings.map(l => ({
                marketplace: l.marketplace,
                originalMarketplace: l.originalMarketplace,
                price: l.price,
                status: l.status
            })));
        }

        return foundListings;
    }, [nftGoListings]);

    // Function to get marketplaces where an NFT is listed
    const getListedMarketplaces = useCallback((nft: NFT): string[] => {
        const listings = getListingsForNFT(nft);
        const marketplaces = listings.map(listing => listing.marketplace);

        // Remove duplicates and return unique marketplace names
        const uniqueMarketplaces = [...new Set(marketplaces)];

        if (process.env.NODE_ENV === 'development') {
            console.log(`NFT ${nft.id} is listed on marketplaces:`, uniqueMarketplaces);
        }

        return uniqueMarketplaces;
    }, [getListingsForNFT]);

    // Function to clear cached listings data
    const clearListingsCache = useCallback((walletAddress?: string) => {
        NFTGo.clearListingsCache(walletAddress);
        console.log(`Cleared listings cache${walletAddress ? ` for ${walletAddress}` : ''}`);
    }, []);

    // Function to force refresh listings (bypasses cache)
    const forceRefreshListings = useCallback(async () => {
        if (!address) {
            console.warn('No wallet address available for force refresh');
            return;
        }

        console.log('Force refreshing listings...');
        await refreshUserListings(true); // Pass forceRefresh=true
    }, [address, refreshUserListings]);

    // Function to check if an NFT is already listed
    const isNFTListed = useCallback((nft: NFT) => {
        // Check if the NFT has any listings
        return getListingsForNFT(nft).length > 0;
    }, [getListingsForNFT]);

    // Modal control functions
    const openListModal = useCallback((nft: NFT) => {
        setSelectedNFT(nft);
        // Open list modal for NFTs that are NOT listed
        if (!isNFTListed(nft)) {
            setIsListModalOpen(true);
        }
    }, [isNFTListed, setSelectedNFT, setIsListModalOpen]);

    const openEditModal = useCallback((nft: NFT) => {
        setSelectedNFT(nft);
        // Open edit modal only for NFTs that ARE listed
        if (isNFTListed(nft)) {
            setIsEditModalOpen(true);
        }
    }, [isNFTListed, setSelectedNFT, setIsEditModalOpen]);



    // Function to handle page changes for pagination with animation
    const handlePageChange = useCallback((newPage: number) => {
        if (newPage === currentPage || isLoadingMore) return;

        devLog(`Changing to page ${newPage}`);
        setIsLoadingMore(true);

        // Use setTimeout to create a smoother animation effect
        setTimeout(() => {
            try {
                // Calculate the start and end indices for the requested page
                const startIndex = (newPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;

                // Get the NFTs for the requested page
                const pageItems = nfts.slice(startIndex, endIndex);

                // Update the displayed NFTs
                setDisplayedNFTs(pageItems);
                setCurrentPage(newPage);
            } catch (error) {
                devError('Error changing page:', error);
            } finally {
                // Add a small delay before removing the loading state
                // to ensure the animation is visible
                setTimeout(() => {
                    setIsLoadingMore(false);
                }, 300);
            }
        }, 100);
    }, [currentPage, itemsPerPage, nfts, isLoadingMore]);

    // Update total pages whenever nfts array changes
    useEffect(() => {
        const pages = Math.ceil(nfts.length / itemsPerPage);
        setTotalPages(Math.max(1, pages));
    }, [nfts.length, itemsPerPage]);

    // Calculate if there are more NFTs to load (for backward compatibility with infinite scroll)
    const hasMoreNFTs = useMemo(() => {
        // If we have a nextCursor, there are more NFTs to load
        // Otherwise, fall back to checking if we've displayed all NFTs from our local array
        return !!nextCursor || displayedNFTs.length < nfts.length;
    }, [displayedNFTs.length, nfts.length, nextCursor]);



    // Cache for NFT offers to reduce API calls
    const offersCache = useRef<Map<string, { data: any[], timestamp: number }>>(new Map());
    const OFFERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

    // Function to get bids for a specific NFT using NFTGo API
    const getBidsForNFT = useCallback((nft: NFT): any[] => {
        if (!nft || !nft.contractAddress || !nft.tokenId) return [];

        // Create a cache key based on the NFT contract and token ID
        const cacheKey = `${nft.contractAddress.toLowerCase()}:${nft.tokenId}`;

        // Check if we have a valid cached result
        const cachedResult = offersCache.current.get(cacheKey);
        const now = Date.now();

        if (cachedResult && (now - cachedResult.timestamp < OFFERS_CACHE_TTL)) {
            devLog(`Using cached offers for ${cacheKey}`);
            return cachedResult.data;
        }

        // If no cached data, return an empty array
        // The actual data will be fetched when needed in the component
        return [];
    }, [OFFERS_CACHE_TTL]);

    // Function to fetch offers for an NFT (to be called from components)
    const fetchOffersForNFT = useCallback(async (nft: NFT): Promise<any[]> => {
        if (!nft || !nft.contractAddress || !nft.tokenId) return [];

        try {
            // Create a cache key based on the NFT contract and token ID
            const cacheKey = `${nft.contractAddress.toLowerCase()}:${nft.tokenId}`;

            // Fetch offers from NFTGo API
            const offers = await NFTGo.getOffersForNFT(nft.contractAddress, nft.tokenId);

            // Cache the result
            offersCache.current.set(cacheKey, {
                data: offers,
                timestamp: Date.now()
            });

            return offers;
        } catch (error) {
            devError('Error fetching offers from NFTGo:', error);
            return [];
        }
    }, []);

    // Function to check if an NFT has any offers
    const hasOffersForNFT = useCallback((nft: NFT): boolean => {
        const bids = getBidsForNFT(nft);
        return bids.length > 0;
    }, [getBidsForNFT]);

    // Function to get the top offer for an NFT
    const getTopOfferForNFT = useCallback((nft: NFT): any | null => {
        const bids = getBidsForNFT(nft);
        if (!bids || bids.length === 0) return null;

        // Sort bids by price (highest first)
        return bids.sort((a: any, b: any) => {
            // Handle NFTGo offer format
            if (a.price && b.price) {
                const priceA = parseFloat(a.price.fee_bps ? a.price.amount : a.price) || 0;
                const priceB = parseFloat(b.price.fee_bps ? b.price.amount : b.price) || 0;
                return priceB - priceA;
            }

            // Default comparison if price format is unknown
            return 0;
        })[0];
    }, [getBidsForNFT]);

    // Multi-selection functions
    const toggleNFTSelection = useCallback((nft: NFT) => {
        // Determine if the NFT is already selected
        const isSelected = selectedNFTs.some(item => item.id === nft.id);

        // Prepare the new selection state
        const newSelectedNFTs = isSelected
            ? selectedNFTs.filter(item => item.id !== nft.id)
            : [...selectedNFTs, nft];

        // Prepare the updated NFT with toggled selection state
        const updatedNft = { ...nft, selected: !nft.selected };

        // Batch update all state in a single render cycle using React 18's automatic batching
        setSelectedNFTs(newSelectedNFTs);

        // Update displayedNFTs and nfts arrays with the new selection state
        setDisplayedNFTs(prev =>
            prev.map(item => item.id === nft.id ? updatedNft : item)
        );

        setNfts(prev =>
            prev.map(item => item.id === nft.id ? updatedNft : item)
        );
    }, [selectedNFTs]);

    const selectAllNFTs = useCallback(() => {
        // Prepare updated NFTs with selection state
        const updatedDisplayedNFTs = displayedNFTs.map(item => ({ ...item, selected: true }));

        // Get IDs of displayed NFTs for efficient lookup
        const displayedNftIds = new Set(displayedNFTs.map(item => item.id));

        // Prepare updated main NFTs array
        const updatedNfts = nfts.map(item =>
            displayedNftIds.has(item.id) ? { ...item, selected: true } : item
        );

        // Batch update all state in a single render cycle
        setSelectedNFTs(updatedDisplayedNFTs);
        setDisplayedNFTs(updatedDisplayedNFTs);
        setNfts(updatedNfts);
    }, [displayedNFTs, nfts]);

    const deselectAllNFTs = useCallback(() => {
        // Prepare updated NFTs with selection state
        const updatedDisplayedNFTs = displayedNFTs.map(item => ({ ...item, selected: false }));
        const updatedNfts = nfts.map(item => ({ ...item, selected: false }));

        // Batch update all state in a single render cycle
        setSelectedNFTs([]);
        setDisplayedNFTs(updatedDisplayedNFTs);
        setNfts(updatedNfts);
    }, [displayedNFTs, nfts]);

    // Computed property to check if there are any selected NFTs
    const hasSelectedNFTs = useMemo(() => {
        return selectedNFTs.length > 0;
    }, [selectedNFTs]);

    // Function to create bulk listings using NFTGo API
    const createBulkListing = useCallback(async (price: string, marketplaces: string[], duration: number) => {
        if (!address || !isConnected) {
            throw new Error('Wallet not connected');
        }

        if (selectedNFTs.length === 0) {
            throw new Error('No NFTs selected for listing');
        }

        try {
            // Format NFTs for the NFTGo API
            // Make sure the token format is correct: contractAddress:tokenId
            const nftsForListing = selectedNFTs.map(nft => {
                // Ensure the contractAddress and tokenId are properly formatted
                const formattedToken = `${nft.contractAddress}:${nft.tokenId}`;

                return {
                    token: formattedToken,
                    price
                };
            });

            // Call the NFTGo API to create listings
            const result = await NFTGo.createNFTListings(
                address,
                nftsForListing,
                marketplaces,
                duration
            );

            // Note: We've removed the automatic refresh and deselect calls
            // The caller should handle these operations if needed

            return result;
        } catch (error) {
            devError('Error creating bulk listings:', error);
            throw error;
        }
    }, [address, isConnected, selectedNFTs]);

    const contextValue = useMemo(() => ({
        nfts,
        isLoading,
        error,
        refreshNFTs,
        selectedNFT,
        openListModal,
        isEditModalOpen,
        isListModalOpen,
        closeEditModal,
        closeListModal,
        // Pagination related properties and functions
        displayedNFTs,
        setDisplayedNFTs,
        hasMoreNFTs,
        loadMoreNFTs,
        isLoadingMore,
        currentPage,
        totalPages,
        handlePageChange,
        // Listing related functions
        isNFTListed,
        getListingInfo,
        getListingsForNFT,
        getListedMarketplaces,
        clearListingsCache,
        forceRefreshListings,
        // User listings pagination (simplified)
        fetchNextUserListingsPage: () => console.log('fetchNextUserListingsPage placeholder'),
        hasMoreUserListings: false,
        // Refresh user listings data
        refreshUserListings,
        openEditModal,
        // Bids related functions
        getBidsForNFT,
        fetchOffersForNFT,
        hasOffersForNFT,
        getTopOfferForNFT,
        // Multi-selection functionality
        selectedNFTs,
        toggleNFTSelection,
        selectAllNFTs,
        deselectAllNFTs,
        hasSelectedNFTs,
        // Bulk listing functionality
        createBulkListing
    }), [
        nfts,
        isLoading,
        error,
        refreshNFTs,
        selectedNFT,
        openListModal,
        isEditModalOpen,
        isListModalOpen,
        closeEditModal,
        closeListModal,
        displayedNFTs,
        hasMoreNFTs,
        loadMoreNFTs,
        isLoadingMore,
        currentPage,
        totalPages,
        handlePageChange,
        isNFTListed,
        getListingInfo,
        getListingsForNFT,
        getListedMarketplaces,
        clearListingsCache,
        forceRefreshListings,
        refreshUserListings,
        openEditModal,
        getBidsForNFT,
        fetchOffersForNFT,
        hasOffersForNFT,
        getTopOfferForNFT,
        // Multi-selection functionality
        selectedNFTs,
        toggleNFTSelection,
        selectAllNFTs,
        deselectAllNFTs,
        hasSelectedNFTs,
        // Bulk listing functionality
        createBulkListing
    ]);

    return (
        <NFTContext.Provider value={contextValue}>
            {children}
        </NFTContext.Provider>
    );
};