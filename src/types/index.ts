// NFT and Marketplace Types

export interface NFT {
  id: string;
  name: string;
  description: string;
  image: string | undefined;
  tokenId: string;
  contractAddress: string;
  owner: string;
  collection?: {
    name: string;
    image?: string | undefined;
    slug?: string;
    opensea_slug?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  lastPrice?: {
    payment_token: {
      address: string;
      symbol: string;
      decimals: number;
    };
    raw_value: string;
    usd: number;
    value: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  traits?: any;
  attributes?: Array<{
    trait_type: string;
    value: string;
    display_type?: string;
    max_value?: number;
    rarity_percentage?: number;
  }>;
  isSpam?: boolean;
  selected?: boolean; // For multi-selection functionality
  listing?: {
    price?: number | string;
    currency?: string;
    marketplace?: string;
    expiration?: number;
    orderHash?: string;
  };
}

export interface NFTContextType {
    nfts: NFT[];
    isLoading: boolean;
    error: string | null;
    refreshNFTs: () => Promise<void>;
    selectedNFT: NFT | null;
    openSellModal: (nft: NFT) => void;
    closeSellModal: () => void;
    // Pagination related properties and functions
    displayedNFTs: NFT[];
    setDisplayedNFTs: (nfts: NFT[]) => void;
    hasMoreNFTs: boolean;
    loadMoreNFTs: () => void;
    isLoadingMore: boolean;
    // Check if an NFT is already listed
    isNFTListed: (nft: NFT) => boolean;
    // Get listing information for an NFT
    getListingInfo: (nft: NFT) => any;
    // User listings pagination
    fetchNextUserListingsPage: () => void;
    hasMoreUserListings: boolean | undefined;
    // Cache reset functions
    resetTokensCache?: () => void;
    resetListingsCache?: () => void;
    // Multi-selection functionality
    selectedNFTs: NFT[];
    toggleNFTSelection: (nft: NFT) => void;
    selectAllNFTs: () => void;
    deselectAllNFTs: () => void;
    hasSelectedNFTs: boolean;
    // Bulk listing functionality
    createBulkListing: (price: string, marketplaces: string[], duration: number) => Promise<any>;
}

export interface MarketplaceListing {
  id: string;
  orderHash?: string;
  contractAddress: string;
  tokenId: string;
  price: number;
  priceUsd?: number;
  currency: string;
  marketplace: string;
  originalMarketplace?: string; // Original marketplace ID from the API
  maker: string;
  status: string;
  createdAt: Date;
  expiresAt?: Date | null;
  expiration?: number; // Unix timestamp for expiration
  kind?: string;
  feeBps?: number;
  feeBreakdown?: Array<{
    bps: number;
    kind: string;
    recipient: string;
  }>;
  nft?: NFT; // Optional reference to the full NFT object
}

export type MarketplaceName = 'opensea' | 'rarible' | 'magiceden' | 'looksrare' | 'nftgo' | 'looks-rare';

export interface MarketplaceInfo {
  name: MarketplaceName;
  displayName: string;
  logo: string;
  description: string;
  url: string;
  supportedChains: string[];
  fees: {
    serviceFee: number;
    creatorFee?: number;
  };
}

export interface MarketplaceComparisonData {
  marketplace: MarketplaceName;
  floorPrice: number;
  volume24h: number;
  listings: number;
  avgPrice: number;
}

export interface WalletInfo {
  address: string;
  ensName?: string;
  balance?: {
    eth?: string;
    matic?: string;
    sol?: string;
  };
}