'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { NFT } from '@/types';

// Define the shape of the context
interface MagicEdenContextType {
  // NFT data
  userNFTs: NFT[];
  isLoadingNFTs: boolean;
  errorLoadingNFTs: string | null;
  refreshUserNFTs: () => Promise<void>;
  
  // Listings data
  userListings: any[];
  
  // Offers data
  userOffersMade: any[];
  userOffersReceived: any[];
  
  // Modal state
  selectedNFT: NFT | null;
  isListModalOpen: boolean;
  openListModal: (nft: NFT) => void;
  closeListModal: () => void;
  
  // Offer modal state
  isOfferModalOpen: boolean;
  openOfferModal: (nft: NFT) => void;
  closeOfferModal: () => void;
}

// Create the context with default values
const MagicEdenContext = createContext<MagicEdenContextType>({
  userNFTs: [],
  isLoadingNFTs: false,
  errorLoadingNFTs: null,
  refreshUserNFTs: async () => {},
  
  userListings: [],
  
  userOffersMade: [],
  userOffersReceived: [],
  
  selectedNFT: null,
  isListModalOpen: false,
  openListModal: () => {},
  closeListModal: () => {},
  
  isOfferModalOpen: false,
  openOfferModal: () => {},
  closeOfferModal: () => {},
});

// Hook to use the context
export const useMagicEden = () => useContext(MagicEdenContext);

// Provider component
export const MagicEdenProvider = ({ children }: { children: ReactNode }) => {
  // NFT state
  const [userNFTs, setUserNFTs] = useState<NFT[]>([]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const [errorLoadingNFTs, setErrorLoadingNFTs] = useState<string | null>(null);
  
  // Listings state
  const [userListings, setUserListings] = useState<any[]>([]);
  
  // Offers state
  const [userOffersMade, setUserOffersMade] = useState<any[]>([]);
  const [userOffersReceived, setUserOffersReceived] = useState<any[]>([]);
  
  // Modal state
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  
  // Function to refresh user NFTs
  const refreshUserNFTs = async () => {
    setIsLoadingNFTs(true);
    setErrorLoadingNFTs(null);
    
    try {
      // This is a placeholder - in a real implementation, you would fetch NFTs from Magic Eden API
      console.log('Fetching NFTs from Magic Eden API...');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set empty NFTs for now
      setUserNFTs([]);
    } catch (error) {
      console.error('Error fetching NFTs from Magic Eden:', error);
      setErrorLoadingNFTs('Failed to load NFTs from Magic Eden. Please try again later.');
    } finally {
      setIsLoadingNFTs(false);
    }
  };
  
  // Modal functions
  const openListModal = (nft: NFT) => {
    setSelectedNFT(nft);
    setIsListModalOpen(true);
  };
  
  const closeListModal = () => {
    setIsListModalOpen(false);
    setTimeout(() => setSelectedNFT(null), 300);
  };
  
  const openOfferModal = (nft: NFT) => {
    setSelectedNFT(nft);
    setIsOfferModalOpen(true);
  };
  
  const closeOfferModal = () => {
    setIsOfferModalOpen(false);
    setTimeout(() => setSelectedNFT(null), 300);
  };
  
  // Create the context value object
  const contextValue = {
    userNFTs,
    isLoadingNFTs,
    errorLoadingNFTs,
    refreshUserNFTs,
    
    userListings,
    
    userOffersMade,
    userOffersReceived,
    
    selectedNFT,
    isListModalOpen,
    openListModal,
    closeListModal,
    
    isOfferModalOpen,
    openOfferModal,
    closeOfferModal,
  };
  
  return (
    <MagicEdenContext.Provider value={contextValue}>
      {children}
    </MagicEdenContext.Provider>
  );
};
