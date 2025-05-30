import { MarketplaceInfo } from '@/types';

// Supported chains
export const SUPPORTED_CHAINS = {
  ETHEREUM: 'ethereum',
  POLYGON: 'polygon',
  SOLANA: 'solana',
};

// Marketplace information
export const MARKETPLACES: Record<string, MarketplaceInfo> = {
  opensea: {
    name: 'opensea',
    displayName: 'OpenSea',
    logo: '/images/opensea-logo.svg',
    description: 'The world\'s first and largest digital marketplace for crypto collectibles and NFTs',
    url: 'https://opensea.io',
    supportedChains: [SUPPORTED_CHAINS.ETHEREUM, SUPPORTED_CHAINS.POLYGON],
    fees: {
      serviceFee: 2.5,
      creatorFee: 5.0,
    },
  },
  rarible: {
    name: 'rarible',
    displayName: 'Rarible',
    logo: '/images/rarible-logo.svg',
    description: 'Create, sell or collect digital items secured with blockchain',
    url: 'https://rarible.com',
    supportedChains: [SUPPORTED_CHAINS.ETHEREUM, SUPPORTED_CHAINS.POLYGON],
    fees: {
      serviceFee: 2.0,
      creatorFee: 5.0,
    },
  },
  looksrare: {
    name: 'looksrare',
    displayName: 'LooksRare',
    logo: '/images/placeholder-nft.svg', // Placeholder, would need a proper logo
    description: 'Next generation NFT marketplace',
    url: 'https://looksrare.org',
    supportedChains: [SUPPORTED_CHAINS.ETHEREUM],
    fees: {
      serviceFee: 2.0,
    },
  },
};

// List of all marketplaces
export const MARKETPLACE_LIST = Object.values(MARKETPLACES);

// Mock data for development
export const MOCK_ENABLED = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';