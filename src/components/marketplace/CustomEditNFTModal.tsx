'use client';

import { NFT } from '@/types';
import { useAccount, useSignTypedData, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { useNFTs } from '@/context/NFTContext';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { X, Clock, Check, Loader2, AlertCircle, CheckCircle, XCircle, ArrowRightLeft } from 'lucide-react';

import { parseEther } from 'viem';
import * as NFTGo from '@/services/marketplace/nftgo';
import { useNFTListings } from '@/hooks/useNFTListings';

// Helper function to introduce delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to wait for a transaction to be mined
const waitForTransaction = async (txHash: string, maxAttempts = 30, interval = 2000): Promise<void> => {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      // Check transaction status using window.ethereum
      const receipt = await (window.ethereum as any).request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });

      // If receipt exists and has blockNumber, transaction is mined
      if (receipt && receipt.blockNumber) {
        return;
      }

      // Wait before next attempt
      await delay(interval);
      attempts++;
    } catch (error) {
      console.warn('Error checking transaction status:', error);
      // Wait before next attempt
      await delay(interval);
      attempts++;
    }
  }

  throw new Error(`Transaction not confirmed after ${maxAttempts} attempts`);
};

// Helper function to parse error messages into user-friendly format
const parseErrorMessage = (error: any): string => {
  // Convert error to string for easier processing
  let errorStr = '';

  if (typeof error === 'string') {
    errorStr = error;
  } else if (error instanceof Error) {
    errorStr = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorStr = (error as any).message;
  } else {
    errorStr = String(error);
  }

  // Remove version information that might be appended to error messages
  errorStr = errorStr.replace(/\s+Version:\s+viem@[\d\.]+$/, '');

  // Check for user rejection patterns
  if (errorStr.includes('User rejected the request') ||
      errorStr.includes('User denied the request') ||
      errorStr.includes('Transaction was rejected in your wallet') ||
      errorStr.includes('User denied transaction signature') ||
      errorStr.includes('MetaMask Tx Signature: User denied')) {
    return 'Error: You\'ve rejected the request';
  }

  // Check for other common error patterns
  if (errorStr.includes('insufficient funds')) {
    return 'Insufficient funds in your wallet to complete this transaction';
  }

  if (errorStr.includes('nonce')) {
    return 'Transaction nonce error. Please try again';
  }

  if (errorStr.includes('gas')) {
    return 'Gas estimation failed. The transaction might fail';
  }

  if (errorStr.includes('network') || errorStr.includes('chain')) {
    return 'Network connection issue. Please check your wallet is on the correct network';
  }

  // For step-specific errors, extract just the essential part
  if (errorStr.includes('Failed at step')) {
    // Try to extract just the step description and details
    const match = errorStr.match(/Failed at step \d+:?\s*(.*?)(?:\s+Details:\s*(.*?))?(?:\s+Version:\s+viem@[\d\.]+)?$/);
    if (match) {
      const [, stepError, details] = match;

      // If we have user rejected message in the details, simplify it
      if ((details && (details.includes('User rejected') || details.includes('User denied'))) ||
          (stepError && (stepError.includes('User rejected') || stepError.includes('User denied')))) {
        return 'Error: You\'ve rejected the request';
      }

      // Return the details if available, otherwise the step error
      return details ? details.trim() : stepError.trim();
    }
  }

  return errorStr;
};

// Marketplace status tracking
interface MarketplaceStatus {
  id: string;
  name: string;
  logo: string;
  requestId: string | null;
  status: 'idle' | 'canceling' | 'canceled' | 'listing' | 'success' | 'failed';
  error: string | null;
  orderbook: string;
  orderKind: string;
}

interface CustomEditNFTModalProps {
  nft: NFT | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Define marketplace configurations
const MARKETPLACES = [
  {
    id: 'opensea',
    name: 'OpenSea',
    logo: 'https://static.nftgo.io/marketplace/Opensea.svg',
    orderbook: 'opensea',
    orderKind: 'seaport-v1.6'
  },
  {
    id: 'looksrare',
    name: 'LooksRare',
    logo: 'https://static-image.nftgo.io/marketplace/looksrare.svg',
    orderbook: 'looks-rare',
    orderKind: 'looks-rare-v2'
  },
  {
    id: 'nftgo',
    name: 'NFTGo',
    logo: 'https://files.readme.io/cdb645a-Vertical.svg',
    orderbook: 'nftgo',
    orderKind: 'payment-processor-v2'
  }
];

// Define marketplace info mapping similar to NFTCard component
const marketplaceInfo: Record<string, { logo: string, name: string, id: string }> = {
  // OpenSea variations
  'opensea': {
    logo: 'https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.svg',
    name: 'OpenSea',
    id: 'opensea'
  },
  'seaport': {
    logo: 'https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.svg',
    name: 'OpenSea',
    id: 'opensea'
  },

  // LooksRare variations
  'looks-rare': {
    logo: 'https://storage.swapspace.co/static/font/src/looks.svg',
    name: 'LooksRare',
    id: 'looksrare'
  },
  'looksrare': {
    logo: 'https://storage.swapspace.co/static/font/src/looks.svg',
    name: 'LooksRare',
    id: 'looksrare'
  },

  // NFTGo variations
  'nftgo': {
    logo: 'https://files.readme.io/cdb645a-Vertical.svg',
    name: 'NFTGo',
    id: 'nftgo'
  },
  'payment-processor': {
    logo: 'https://files.readme.io/cdb645a-Vertical.svg',
    name: 'NFTGo',
    id: 'nftgo'
  },
  'nftgo.io': {
    logo: 'https://files.readme.io/cdb645a-Vertical.svg',
    name: 'NFTGo',
    id: 'nftgo'
  },

  // Other marketplaces
  'rarible': {
    logo: 'https://rarible.com/favicon.ico',
    name: 'Rarible',
    id: 'rarible'
  }
};

export default function CustomEditNFTModal({ nft, isOpen, onClose, onSuccess }: CustomEditNFTModalProps) {
  const { refreshUserListings, refreshNFTs, closeEditModal, getListingInfo, isNFTListed } = useNFTs();
  const { address, chain } = useAccount();
  const { getListingsForNFT, refreshListings } = useNFTListings();

  const [price, setPrice] = useState<string>('');
  const [initialPrice, setInitialPrice] = useState<string>(''); // Store the initial price for comparison
  const [duration, setDuration] = useState<number>(7); // Default 7 days
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>(['opensea']); // Default to OpenSea
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  // Track marketplace-specific status
  const [marketplaceStatuses, setMarketplaceStatuses] = useState<MarketplaceStatus[]>([]);

  // Polling references
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Wagmi hooks
  const { signTypedDataAsync } = useSignTypedData();
  const { data: txHash, sendTransactionAsync, error: txError } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmationError } = useWaitForTransactionReceipt({ hash: txHash });

  // Get the current listings for this NFT
  const currentListings = useMemo(() => {
    if (!nft) return [];
    return getListingsForNFT(nft);
  }, [nft, getListingsForNFT]);

  // Memoize the listing info to prevent repeated calls to getListingInfo
  const listingInfo = useMemo(() => {
    if (!nft) return null;
    return getListingInfo(nft);
  }, [nft, getListingInfo]);

  // Memoize the NFT listing status to prevent repeated calls
  const isListed = useMemo(() => {
    if (!nft) return false;
    return isNFTListed(nft);
  }, [nft, isNFTListed]);

  // Determine which marketplaces are currently active - memoized to prevent recalculation
  const activeMarketplaces = useMemo(() => {
    // First check if the NFT is listed according to isNFTListed
    if (!nft || !isListed) {
      return [];
    }

    // If we have listings from NFTGo, use those
    if (currentListings.length > 0) {
      const marketplaceIds = currentListings.map(listing => {
        const marketplace = listing.marketplace.toLowerCase();
        const originalMarketplace = listing.originalMarketplace?.toLowerCase() || marketplace;

        // Check for marketplace matches using both marketplace and originalMarketplace
        if (marketplace.includes('opensea') || originalMarketplace.includes('opensea') ||
            marketplace.includes('seaport') || originalMarketplace.includes('seaport')) {
          return 'opensea';
        }

        if (marketplace.includes('looksrare') || originalMarketplace.includes('looksrare') ||
            marketplace.includes('looks-rare') || originalMarketplace.includes('looks-rare')) {
          return 'looksrare';
        }

        if (marketplace.includes('blur') || originalMarketplace.includes('blur')) {
          return 'blur';
        }

        if (marketplace.includes('nftgo') || originalMarketplace.includes('nftgo') ||
            marketplace.includes('payment-processor') || originalMarketplace.includes('payment-processor')) {
          return 'nftgo';
        }

        // If no match found, return the original marketplace
        return marketplace;
      });

      // Return unique marketplace IDs
      return [...new Set(marketplaceIds)];
    } else {
      // If no NFTGo listings but NFT is listed according to isNFTListed,
      // try to get the marketplace from the listing info (same as NFTCard)
      if (listingInfo && listingInfo.marketplace) {
        // Get the marketplace ID from the marketplace info mapping
        const marketplaceId = listingInfo.marketplace.toLowerCase();

        // Try to find a matching marketplace in our mapping
        for (const [key, info] of Object.entries(marketplaceInfo)) {
          if (marketplaceId.includes(key)) {
            return [info.id];
          }
        }

        // If we couldn't match it to a known marketplace, use the raw marketplace ID
        return [marketplaceId];
      }

      // If all else fails, default to opensea
      return ['opensea'];
    }
  }, [nft, currentListings, isListed, listingInfo]);

  // Initialize price and marketplaces only when modal opens
  // Use a ref to track if we've already initialized values for this modal session
  const initializedRef = useRef(false);

  // Store values in refs to avoid stale closures and dependency issues
  const listingInfoRef = useRef(listingInfo);
  const isListedRef = useRef(isListed);
  const activeMarketplacesRef = useRef(activeMarketplaces);

  // Update refs when values change
  useEffect(() => {
    listingInfoRef.current = listingInfo;
    isListedRef.current = isListed;
    activeMarketplacesRef.current = activeMarketplaces;
  }, [listingInfo, isListed, activeMarketplaces]);

  // Use a separate effect with a more limited dependency array to avoid infinite loops
  useEffect(() => {
    // Only initialize once when the modal opens or reset when it closes
    if (!isOpen) {
      // Reset the initialization flag when the modal closes
      initializedRef.current = false;
    } else if (isOpen && nft && !initializedRef.current) {
      // Set flag to prevent re-initialization
      initializedRef.current = true;

      // Initialize in a separate effect with a setTimeout to break the render cycle
      setTimeout(() => {
        // Access values from refs to avoid stale closures
        const currentListingInfo = listingInfoRef.current;
        const currentIsListed = isListedRef.current;
        const currentActiveMarketplaces = activeMarketplacesRef.current;

        // Set the initial price from the current listing
        if (currentListingInfo && currentListingInfo.price) {
          const currentPrice = currentListingInfo.price.toString();
          setPrice(currentPrice);
          setInitialPrice(currentPrice); // Store the initial price for comparison
        } else if (currentIsListed) {
          // If no specific price found but NFT is listed, use default
          setPrice('0.01'); // Default price if none found
          setInitialPrice('0.01');
        }

        // Set the selected marketplaces based on current listings
        if (currentActiveMarketplaces.length > 0) {
          setSelectedMarketplaces(currentActiveMarketplaces);
        } else {
          // If no active marketplaces detected but NFT is listed, default to opensea
          if (currentIsListed) {
            setSelectedMarketplaces(['opensea']);
          }
        }
      }, 0);
    }
  }, [isOpen, nft]);

  // Function to update the status of a specific marketplace
  const updateMarketplaceStatus = useCallback((
    marketplaceId: string,
    updates: Partial<MarketplaceStatus>
  ) => {
    setMarketplaceStatuses(prev => {
      const updatedStatuses = prev.map(status => {
        if (status.id === marketplaceId) {
          return { ...status, ...updates };
        }
        return status;
      });



      return updatedStatuses;
    });
  }, []);

  // Handle manual close with refresh
  const handleClose = useCallback(() => {
    // If we're in the middle of submitting and no marketplace has succeeded yet, show confirmation dialog
    if (isSubmitting && !marketplaceStatuses.some(status => status.status === 'success')) {
      if (confirm("Are you sure you want to close? The process is still running.")) {
        // Clear all polling intervals
        pollingIntervalsRef.current.forEach((interval) => {
          clearInterval(interval);
        });
        pollingIntervalsRef.current.clear();

        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        onClose();
        setTimeout(() => closeEditModal(), 300);
      }
      return;
    }

    // If listing was successful, refresh user listings before closing
    if (success) {
      console.log('Refreshing user listings and NFTs on manual close...');

      // Force refresh the listings to bypass rate limiting
      refreshListings(true).then(() => {
        console.log('Listings refreshed successfully');
        // Then refresh NFTs to update the UI
        refreshNFTs();

        // Also refresh user listings from the NFT context
        refreshUserListings();

        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess();
        }
      }).catch(err => {
        console.error('Error refreshing listings:', err);
      });
    }

    // Clear all polling intervals
    pollingIntervalsRef.current.forEach((interval) => {
      clearInterval(interval);
    });
    pollingIntervalsRef.current.clear();

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    onClose();
    setTimeout(() => closeEditModal(), 300);
  }, [isSubmitting, success, refreshUserListings, refreshListings, onClose, closeEditModal, refreshNFTs, onSuccess, marketplaceStatuses]);

  // Reset form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
      setCurrentStep(null);
      setProcessingStep(0);
      setTotalSteps(0);


      // Clear any existing polling intervals
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Clear all marketplace-specific polling intervals
      pollingIntervalsRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      pollingIntervalsRef.current.clear();
    } else {
      // Reset initialPrice when modal closes to prevent stale data
      setInitialPrice('');
    }
  }, [isOpen]);

  // Update marketplace statuses when selectedMarketplaces changes
  useEffect(() => {
    if (isOpen && selectedMarketplaces.length > 0) {
      setMarketplaceStatuses(MARKETPLACES.filter(m =>
        selectedMarketplaces.includes(m.id)
      ).map(m => ({
        id: m.id,
        name: m.name,
        logo: m.logo,
        requestId: null,
        status: 'idle',
        error: null,
        orderbook: m.orderbook,
        orderKind: m.orderKind
      })));
    }
  }, [isOpen, selectedMarketplaces]);

  // Handle transaction confirmation state
  useEffect(() => {
    if (isConfirming) {
      setCurrentStep(`Confirming transaction...`);
    }
    if (isConfirmed) {
      setCurrentStep(`Transaction confirmed!`);
    }
    if (confirmationError) {
      setError(parseErrorMessage(confirmationError));
      setIsSubmitting(false); // Stop processing on error
    }
  }, [isConfirming, isConfirmed, confirmationError]);

  // Handle transaction sending errors
  useEffect(() => {
    if (txError) {
      setError(parseErrorMessage(txError));
      setIsSubmitting(false); // Stop processing on error
    }
  }, [txError]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    // This effect doesn't need to do anything on mount
    // It only needs to clean up on unmount

    return () => {
      // Clean up the single polling interval if it exists
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Store a reference to the current Map to avoid React warnings
      const currentPollingIntervalsMap = pollingIntervalsRef.current;

      // Clean up all polling intervals in the Map if it exists
      if (currentPollingIntervalsMap) {
        // Create a copy of the current intervals to avoid issues with the Map changing during iteration
        const intervalIds = Array.from(currentPollingIntervalsMap.values());

        // Clear all intervals in the copy
        intervalIds.forEach(intervalId => {
          if (typeof intervalId === 'number') {
            clearInterval(intervalId);
          }
        });

        // Clear the Map
        currentPollingIntervalsMap.clear();
      }
    };
  }, []);

  // Function to check the status of a specific marketplace listing
  const checkMarketplaceStatus = useCallback(async (
    marketplaceId: string,
    requestId: string
  ) => {
    if (!requestId) return false;

    try {
      console.log(`Checking order status for ${marketplaceId} with request ID:`, requestId);
      const result = await NFTGo.checkPostOrderResults([requestId]);
      console.log(`Order status check result for ${marketplaceId}:`, JSON.stringify(result, null, 2));

      // First check if the API call was successful
      if (result && result.code === 'SUCCESS') {
        // Check if we have post_order_results in the data
        if (result.data && Array.isArray(result.data.post_order_results)) {
          // If post_order_results is empty, it's still processing
          if (result.data.post_order_results.length === 0) {
            console.log(`Order for ${marketplaceId} is still processing (empty post_order_results array)`);
            return false;
          }

          // Find the result for this marketplace
          const orderResult = result.data.post_order_results.find(
            (r: any) => r.request_id === requestId
          );

          if (orderResult) {
            // Check the status of the order
            if (orderResult.status === 'success') {
              console.log(`Order for ${marketplaceId} was successful!`);
              updateMarketplaceStatus(marketplaceId, {
                status: 'success',
                error: null
              });

              // Clear the polling interval for this marketplace
              const interval = pollingIntervalsRef.current.get(marketplaceId);
              if (interval) {
                clearInterval(interval);
                pollingIntervalsRef.current.delete(marketplaceId);
              }

              // Refresh listings for this marketplace
              await refreshUserListings();
              return true;
            } else if (orderResult.status === 'failed') {
              // Order failed with an error
              console.error(`Order for ${marketplaceId} failed:`, orderResult.status_reason || 'Unknown error');
              updateMarketplaceStatus(marketplaceId, {
                status: 'failed',
                error: `Listing failed: ${orderResult.status_reason || 'Unknown error'}`
              });

              // Clear the polling interval for this marketplace
              const interval = pollingIntervalsRef.current.get(marketplaceId);
              if (interval) {
                clearInterval(interval);
                pollingIntervalsRef.current.delete(marketplaceId);
              }

              return false;
            } else if (orderResult.status === 'pending') {
              // Order is still pending
              console.log(`Order for ${marketplaceId} is still pending, will check again later`);
              return false;
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error(`Error checking order status for ${marketplaceId}:`, error);
      return false;
    }
  }, [updateMarketplaceStatus, refreshUserListings]);

  // Start polling for a specific marketplace listing status
  const startPollingForMarketplace = useCallback((marketplaceId: string, requestId: string) => {
    // Clear any existing polling for this marketplace
    const existingInterval = pollingIntervalsRef.current.get(marketplaceId);
    if (existingInterval) {
      clearInterval(existingInterval);
      pollingIntervalsRef.current.delete(marketplaceId);
    }

    // Set the marketplace to pending status
    updateMarketplaceStatus(marketplaceId, {
      requestId,
      status: 'listing',
      error: null
    });

    // Track attempts for NFTGo orderbook special handling
    let attempts = 0;
    const maxNFTGoAttempts = 5; // Consider NFTGo listing successful after 5 empty results

    // Get the marketplace configuration
    const marketplace = marketplaceStatuses.find(m => m.id === marketplaceId);
    const isNFTGoOrderbook = marketplace?.orderbook === 'nftgo';

    // Start a new polling interval
    const pollInterval = setInterval(async () => {
      attempts++;
      console.log(`Polling attempt ${attempts} for ${marketplaceId} with request ID: ${requestId}`);

      const result = await checkMarketplaceStatus(marketplaceId, requestId);

      // Special handling for NFTGo orderbook with empty results
      if (isNFTGoOrderbook && attempts >= maxNFTGoAttempts && !result) {
        console.log(`${maxNFTGoAttempts} attempts reached with empty results for NFTGo orderbook - considering it a successful listing`);

        // Mark as success
        updateMarketplaceStatus(marketplaceId, {
          status: 'success',
          error: null
        });

        // Clear the polling interval
        const interval = pollingIntervalsRef.current.get(marketplaceId);
        if (interval) {
          clearInterval(interval);
          pollingIntervalsRef.current.delete(marketplaceId);
        }

        // Refresh listings
        await refreshUserListings();
      }

      // Check if any marketplace has succeeded
      const anySuccess = marketplaceStatuses.some(status => status.status === 'success');

      // Check if all marketplaces have completed (success or failed)
      const allCompleted = marketplaceStatuses.every(
        status => status.status === 'success' || status.status === 'failed'
      );

      if (anySuccess) {
        // If any marketplace has succeeded, we can consider the operation successful
        // Refresh listings and NFTs with force refresh to bypass rate limiting
        console.log('At least one marketplace succeeded. Force refreshing listings and NFTs...');
        try {
          // Force refresh the listings to bypass rate limiting
          await refreshUserListings();
          console.log('Listings refreshed successfully');

          // Then refresh NFTs to update the UI
          refreshNFTs();

        } catch (refreshError) {
          console.error('Error refreshing data after success:', refreshError);
        }

        // Set success state
        setSuccess(true);
        setCurrentStep('Listing Updated Successfully!');
        console.log('Showing success UI.');

        // Always set isSubmitting to false when any marketplace succeeds
        // This allows the user to close the modal without warnings
        setIsSubmitting(false);
        console.log('Setting isSubmitting to false because at least one marketplace succeeded');

        // If all marketplaces have completed, we can stop polling completely
        if (allCompleted) {
          // Clear all polling intervals
          pollingIntervalsRef.current.forEach((interval) => {
            clearInterval(interval);
          });
          pollingIntervalsRef.current.clear();
          console.log('All marketplaces completed processing. Stopping all polling.');
        } else {
          // Some marketplaces are still processing, but we've already shown success
          // We'll keep polling for the remaining marketplaces in the background
          console.log('Some marketplaces still processing, but at least one succeeded. Continuing to poll for others in the background.');
        }
      } else if (allCompleted) {
        // All marketplaces have completed but none succeeded
        // Refresh listings and NFTs with force refresh to bypass rate limiting
        console.log('All marketplaces completed but none succeeded. Force refreshing listings and NFTs...');
        try {
          // Force refresh the listings to bypass rate limiting
          await refreshUserListings();
          console.log('Listings refreshed successfully');

          // Then refresh NFTs to update the UI
          refreshNFTs();

        } catch (refreshError) {
          console.error('Error refreshing data after failure:', refreshError);
        }

        // Set error state
        setError('All marketplace listings failed. Please try again.');
        setCurrentStep('Listing update failed');
        console.log('All marketplaces completed processing. All failed.');

        // Clear all polling intervals
        pollingIntervalsRef.current.forEach((interval) => {
          clearInterval(interval);
        });
        pollingIntervalsRef.current.clear();

        // Set isSubmitting to false to update the UI
        setIsSubmitting(false);
      } else {
        // Not all marketplaces have completed yet and none have succeeded
        console.log('Not all marketplaces have completed processing yet. Continuing to poll...');
      }
    }, 3000); // Poll every 3 seconds

    // Store the interval reference
    pollingIntervalsRef.current.set(marketplaceId, pollInterval);

    // Set a timeout to stop polling after 2 minutes (120000ms)
    setTimeout(() => {
      const interval = pollingIntervalsRef.current.get(marketplaceId);
      if (interval) {
        clearInterval(interval);
        pollingIntervalsRef.current.delete(marketplaceId);

        // If the status is still pending after timeout, mark as failed
        const marketplace = marketplaceStatuses.find(m => m.id === marketplaceId);
        if (marketplace && marketplace.status === 'listing') {
          updateMarketplaceStatus(marketplaceId, {
            status: 'failed',
            error: 'Listing timed out. Please check the marketplace directly.'
          });
        }
      }
    }, 120000); // 2 minute timeout
  }, [checkMarketplaceStatus, marketplaceStatuses, refreshNFTs, refreshUserListings, updateMarketplaceStatus]);

  // Handle the edit process
  const handleSubmit = async () => {
    if (!nft || !address || !price || parseFloat(price) <= 0 || selectedMarketplaces.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    setCurrentStep('Preparing to update listing...');
    setProcessingStep(0);

    // Store the original marketplaces where the NFT is listed
    // We'll use this to ensure we only relist on the same marketplaces
    const originalMarketplaces = new Set<string>();

    try {
      // Step 1: Cancel all existing listings using the NFTGo API
      setCurrentStep('Canceling existing listings...');
      console.log('STEP 1: Starting cancellation process');

      // Add a delay to ensure UI updates before proceeding
      await delay(1000);

      // Group listings by marketplace for better tracking
      const marketplaceListings = new Map<string, any[]>();

      // Process current listings and normalize marketplace IDs
      console.log('Current listings:', currentListings);

      // Log active marketplaces for debugging
      console.log('Active marketplaces:', activeMarketplaces);
      console.log('Selected marketplaces:', selectedMarketplaces);

      if (currentListings.length === 0) {
        console.log('WARNING: No current listings found to cancel');

        // If we have active marketplaces from the UI but no listings found in the data,
        // create entries for each active marketplace to ensure cancellation is attempted
        if (activeMarketplaces.length > 0) {
          console.log('Using active marketplaces from UI for cancellation');

          // For each active marketplace, create a placeholder entry
          activeMarketplaces.forEach(marketplaceId => {
            // Get the listing info for this NFT
            const listing = listingInfo;
            if (listing) {
              // Normalize marketplace ID to ensure it matches expected format
              const normalizedMarketplaceId = marketplaceId.toLowerCase().includes('opensea')
                ? 'opensea'
                : marketplaceId.toLowerCase().includes('looksrare')
                  ? 'looksrare'
                  : marketplaceId.toLowerCase().includes('nftgo')
                    ? 'nftgo'
                    : marketplaceId;

              console.log(`Normalized marketplace ID: ${normalizedMarketplaceId} (from ${marketplaceId})`);

              // Create an array for this marketplace if it doesn't exist
              if (!marketplaceListings.has(normalizedMarketplaceId)) {
                marketplaceListings.set(normalizedMarketplaceId, []);
              }

              // Add the listing to the marketplace's array
              marketplaceListings.get(normalizedMarketplaceId)?.push({
                id: listing.id,
                orderHash: listing.orderHash,
                marketplace: normalizedMarketplaceId
              });

              // Add to original marketplaces set
              originalMarketplaces.add(normalizedMarketplaceId);
            }
          });
        }
      }

      currentListings.forEach(listing => {
        const marketplaceId = listing.marketplace.toLowerCase().includes('opensea')
          ? 'opensea'
          : listing.marketplace.toLowerCase().includes('looksrare')
          ? 'looksrare'
          : listing.marketplace.toLowerCase().includes('nftgo')
          ? 'nftgo'
          : listing.marketplace;

        console.log(`Processing listing for marketplace: ${marketplaceId}`, listing);

        // Store the original marketplace ID for relisting
        originalMarketplaces.add(marketplaceId);

        // Group listings by marketplace
        if (!marketplaceListings.has(marketplaceId)) {
          marketplaceListings.set(marketplaceId, []);
        }

        marketplaceListings.get(marketplaceId)?.push(listing);
      });

      console.log('Grouped listings by marketplace:',
        Array.from(marketplaceListings.entries()).map(([key, value]) =>
          `${key}: ${value.length} listings`
        )
      );
      console.log('Original marketplaces to relist on:', Array.from(originalMarketplaces));

      // Set total steps based on cancel + create for each marketplace
      setTotalSteps((marketplaceListings.size * 2) || 2); // At least 2 steps

      // Cancel listings for each marketplace
      let cancelStep = 1;
      const cancelledMarketplaces = new Set<string>();

      // Calculate total cancel steps
      const totalCancelSteps = marketplaceListings.size;
      console.log(`Starting cancellation process for ${totalCancelSteps} marketplaces`);

      // Check if we have any marketplaces to cancel
      if (totalCancelSteps === 0) {
        console.log('WARNING: No marketplaces to cancel listings from');
        console.log('Skipping cancellation step and moving to create listings');

        // If there are no listings to cancel but we know the NFT is listed,
        // try one more time to use active marketplaces
        if (activeMarketplaces.length > 0 && isListed) {
          console.log('No listings found in marketplaceListings, but NFT is listed. Using active marketplaces from UI.');

          // For each active marketplace, create a placeholder entry
          activeMarketplaces.forEach(marketplaceId => {
            // Get the listing info for this NFT
            const listing = listingInfo;
            if (listing) {
              console.log(`Adding listing for marketplace ${marketplaceId} from listingInfo:`, listing);

              // Normalize marketplace ID to ensure it matches expected format
              const normalizedMarketplaceId = marketplaceId.toLowerCase().includes('opensea')
                ? 'opensea'
                : marketplaceId.toLowerCase().includes('looksrare')
                  ? 'looksrare'
                  : marketplaceId.toLowerCase().includes('nftgo')
                    ? 'nftgo'
                    : marketplaceId;

              console.log(`Normalized marketplace ID: ${normalizedMarketplaceId} (from ${marketplaceId})`);

              // Create an array for this marketplace if it doesn't exist
              if (!marketplaceListings.has(normalizedMarketplaceId)) {
                marketplaceListings.set(normalizedMarketplaceId, []);
              }

              // Add the listing to the marketplace's array
              marketplaceListings.get(normalizedMarketplaceId)?.push({
                id: listing.id,
                orderHash: listing.orderHash,
                marketplace: normalizedMarketplaceId
              });

              // Add to original marketplaces set
              originalMarketplaces.add(normalizedMarketplaceId);
            }
          });

          // Recalculate total cancel steps
          const newTotalCancelSteps = marketplaceListings.size;
          console.log(`Recalculated cancellation process for ${newTotalCancelSteps} marketplaces`);

          // If we still have no marketplaces, use the selected ones
          if (newTotalCancelSteps === 0) {
            // If there are no listings to cancel, we'll use the selected marketplaces
            selectedMarketplaces.forEach(id => originalMarketplaces.add(id));
          } else {
            // We found marketplaces to cancel, so we'll continue with the cancellation process
            // Update the total steps
            setTotalSteps((marketplaceListings.size * 2) || 2);

            // Process each marketplace (this will be handled in the else block)
            // Skip the delay and continue to the else block by jumping directly to it
            await delay(500); // Small delay for UI update
            // Continue to the else block by setting a flag
            const skipToElse = true;
            if (skipToElse) {
              // Process each marketplace
              for (const [marketplaceId, listings] of marketplaceListings.entries()) {
                console.log(`Processing cancellation for marketplace: ${marketplaceId} with ${listings.length} listings`);

                // Update the marketplace status to canceling
                const marketplace = marketplaceStatuses.find(m => m.id === marketplaceId);
                if (marketplace) {
                  updateMarketplaceStatus(marketplaceId, {
                    status: 'canceling',
                    error: null
                  });
                }

                // Update UI to show current step
                setProcessingStep(cancelStep);
                setCurrentStep(`Canceling ${marketplaceId} listing...`);

                // Small delay to ensure UI updates before proceeding
                await delay(1000);

                try {
                  // Get the order IDs to cancel
                  const orderIds = listings.map(listing => listing.orderHash || listing.id);

                  if (orderIds.length === 0) {
                    console.warn(`No listings found to cancel for ${marketplaceId}`);
                    cancelStep++;
                    continue;
                  }

                  console.log(`Canceling ${orderIds.length} orders for ${marketplaceId}`);

                  // Call the NFTGo API to cancel listings
                  const response = await NFTGo.cancelNFTListings(address, orderIds);
                  console.log(`Cancel listings result for ${marketplaceId}:`, response);

                  // Process the response to handle wallet transactions
                  if (response && response.code === 'SUCCESS' && response.data && response.data.actions) {
                    console.log(`Response contains ${response.data.actions.length} actions for ${marketplaceId}:`,
                      response.data.actions.map((a: any) => a.kind).join(', '));

                    // Find transaction actions that need to be processed
                    const transactionActions = response.data.actions.filter(
                      (action: any) => action.kind === 'transaction' && action.data && action.data.tx_data
                    );

                    if (transactionActions.length > 0) {
                      // Process each transaction action
                      for (const action of transactionActions) {
                        try {
                          const txData = action.data.tx_data;
                          console.log('Processing transaction for cancellation:', action.name);
                          console.log('Transaction data:', txData);

                          // Create a transaction request
                          const txRequest = {
                            from: txData.from,
                            to: txData.to,
                            data: txData.data,
                            value: txData.value || '0x0'
                          };

                          // Send the transaction using the wallet
                          // This will prompt the user to sign the transaction
                          if (!window.ethereum) {
                            throw new Error('No Ethereum provider found');
                          }

                          setCurrentStep(`Waiting for wallet signature to cancel ${marketplaceId} listing...`);
                          console.log(`⚠️ IMPORTANT: Waiting for wallet signature to cancel ${marketplaceId} listing... Check your wallet!`);

                          // Use type assertion for window.ethereum
                          // Request the transaction
                          const txHash = await (window.ethereum as any).request({
                            method: 'eth_sendTransaction',
                            params: [txRequest],
                          });

                          console.log('Transaction sent:', txHash);

                          // Wait for transaction confirmation
                          // Implement a polling mechanism to check transaction status
                          try {
                            // Wait for the transaction to be mined
                            await waitForTransaction(txHash);
                            console.log('Transaction confirmed:', txHash);
                          } catch (confirmError) {
                            console.warn('Could not confirm transaction, but it might still succeed:', confirmError);
                          }
                        } catch (txError) {
                          console.error('Transaction error:', txError);

                          // Check if this was a user rejection
                          const errorMessage = parseErrorMessage(txError);
                          const isUserRejection = errorMessage.includes("You've rejected the request");

                          if (isUserRejection) {
                            console.log('User rejected the transaction, stopping the entire process');
                            setError('Error: You\'ve rejected the request');
                            setCurrentStep('Listing update cancelled');
                            setIsSubmitting(false);
                            throw new Error('Error: You\'ve rejected the request'); // This will exit the entire process
                          } else {
                            throw new Error(`Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`);
                          }
                        }
                      }
                    } else {
                      console.log('No transaction actions found in the response');
                    }
                  }

                  // Update the marketplace status to canceled
                  updateMarketplaceStatus(marketplaceId, {
                    status: 'canceled',
                    error: null
                  });

                  // Add to successfully cancelled marketplaces
                  cancelledMarketplaces.add(marketplaceId);

                  // Wait a moment to ensure the cancellation is processed
                  // and the UI has time to update
                  await delay(2000);

                } catch (cancelError) {
                  console.error(`Error canceling listings for ${marketplaceId}:`, cancelError);

                  // Check if this was a user rejection
                  const errorMessage = parseErrorMessage(cancelError);
                  const isUserRejection = errorMessage.includes("You've rejected the request");

                  // Update the marketplace status to failed
                  updateMarketplaceStatus(marketplaceId, {
                    status: 'failed',
                    error: `Failed to cancel listing: ${errorMessage}`
                  });

                  // If user rejected the transaction, we should stop the entire process
                  if (isUserRejection) {
                    setError(errorMessage);
                    setCurrentStep('Listing update cancelled');
                    setIsSubmitting(false);
                    throw new Error(errorMessage); // This will exit the entire try/catch block
                  }

                  // Continue with other marketplaces
                  cancelStep++;
                  continue;
                }

                cancelStep++;
                console.log(`Completed cancellation step ${cancelStep-1} of ${newTotalCancelSteps}`);
              }

              console.log(`Cancellation process completed for ${cancelledMarketplaces.size} marketplaces`);

              // Add a small delay before moving to the next phase
              await delay(1000);

            }
          }
        } else {
          // If there are no listings to cancel, we'll use the selected marketplaces
          selectedMarketplaces.forEach(id => originalMarketplaces.add(id));
        }

        // Wait a moment to ensure the UI updates
        await delay(2000);
      } else {
        // Process each marketplace
        for (const [marketplaceId, listings] of marketplaceListings.entries()) {
          console.log(`Processing cancellation for marketplace: ${marketplaceId} with ${listings.length} listings`);

          // Update the marketplace status to canceling
          const marketplace = marketplaceStatuses.find(m => m.id === marketplaceId);
          if (marketplace) {
            updateMarketplaceStatus(marketplaceId, {
              status: 'canceling',
              error: null
            });
          }

          // Update UI to show current step
          setProcessingStep(cancelStep);
          setCurrentStep(`Canceling ${marketplaceId.toLocaleUpperCase()} listing...`);

          // Small delay to ensure UI updates before proceeding
          await delay(1000);

        try {
          // Get the order IDs to cancel
          const orderIds = listings.map(listing => listing.orderHash || listing.id);

          if (orderIds.length === 0) {
            console.warn(`No listings found to cancel for ${marketplaceId}`);
            cancelStep++;
            continue;
          }

          console.log(`Canceling ${orderIds.length} orders for ${marketplaceId}`);

          // Call the NFTGo API to cancel listings
          const response = await NFTGo.cancelNFTListings(address, orderIds);
          console.log(`Cancel listings result for ${marketplaceId}:`, response);

          // Process the response to handle wallet transactions
          if (response && response.code === 'SUCCESS' && response.data && response.data.actions) {
            console.log(`Response contains ${response.data.actions.length} actions for ${marketplaceId}:`,
              response.data.actions.map((a: any) => a.kind).join(', '));

            // Find transaction actions that need to be processed
            const transactionActions = response.data.actions.filter(
              (action: any) => action.kind === 'transaction' && action.data && action.data.tx_data
            );

            console.log(`Found ${transactionActions.length} transaction actions to process for ${marketplaceId}`);

            if (transactionActions.length > 0) {
              // Process each transaction action
              for (const action of transactionActions) {
                try {
                  const txData = action.data.tx_data;
                  console.log('Processing transaction for cancellation:', action.name);
                  console.log('Transaction data:', txData);

                  // Create a transaction request
                  const txRequest = {
                    from: txData.from,
                    to: txData.to,
                    data: txData.data,
                    value: txData.value || '0x0'
                  };

                  // Send the transaction using the wallet
                  // This will prompt the user to sign the transaction
                  if (!window.ethereum) {
                    throw new Error('No Ethereum provider found');
                  }

                  setCurrentStep(`Waiting for wallet signature to cancel ${marketplaceId.toLocaleUpperCase()} listing...`);
                  console.log(`⚠️ IMPORTANT: Waiting for wallet signature to cancel ${marketplaceId} listing... Check your wallet!`);

                  // Use type assertion for window.ethereum
                  // Request the transaction
                  const txHash = await (window.ethereum as any).request({
                    method: 'eth_sendTransaction',
                    params: [txRequest],
                  });

                  console.log('Transaction sent:', txHash);

                  // Wait for transaction confirmation
                  setCurrentStep(`Waiting for transaction confirmation...`);
                  try {
                    // Wait for the transaction to be mined
                    await waitForTransaction(txHash);
                    console.log('Transaction confirmed:', txHash);
                  } catch (confirmError) {
                    console.warn('Could not confirm transaction, but it might still succeed:', confirmError);
                  }
                } catch (txError) {
                  console.error('Transaction error:', txError);

                  // Check if this was a user rejection
                  const errorMessage = parseErrorMessage(txError);
                  const isUserRejection = errorMessage.includes("You've rejected the request");

                  if (isUserRejection) {
                    console.log('User rejected the transaction, stopping the entire process');
                    setError('Error: You\'ve rejected the request');
                    setCurrentStep('Listing update cancelled');
                    setIsSubmitting(false);
                    throw new Error('Error: You\'ve rejected the request'); // This will exit the entire process
                  } else {
                    throw new Error(`Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`);
                  }
                }
              }
            } else {
              console.log('No transaction actions found in the response');
            }
          }

          // Update the marketplace status to canceled
          updateMarketplaceStatus(marketplaceId, {
            status: 'canceled',
            error: null
          });

          // Add to successfully cancelled marketplaces
          cancelledMarketplaces.add(marketplaceId);

          // Wait a moment to ensure the cancellation is processed
          // and the UI has time to update
          await delay(2000);

        } catch (cancelError) {
          console.error(`Error canceling listings for ${marketplaceId}:`, cancelError);

          // Check if this was a user rejection
          const errorMessage = parseErrorMessage(cancelError);
          const isUserRejection = errorMessage.includes("You've rejected the request");

          // Update the marketplace status to failed
          updateMarketplaceStatus(marketplaceId, {
            status: 'failed',
            error: `Failed to cancel listing: ${errorMessage}`
          });

          // If user rejected the transaction, we should stop the entire process
          if (isUserRejection) {
            setError(errorMessage);
            setCurrentStep('Listing update cancelled');
            setIsSubmitting(false);
            throw new Error(errorMessage); // This will exit the entire try/catch block
          }

          // Continue with other marketplaces
          cancelStep++;
          continue;
        }

        cancelStep++;
        console.log(`Completed cancellation step ${cancelStep-1} of ${totalCancelSteps}`);
        } // Close the for loop
      } // Close the else statement

      console.log(`Cancellation process completed for ${cancelledMarketplaces.size} marketplaces`);

      // Add a small delay before moving to the next phase
      await delay(1000);

      // Refresh listings to ensure we have the latest state
      await refreshUserListings();

      // Step 2: Create new listings only for marketplaces where we successfully cancelled
      setCurrentStep('Creating new listings...');

      // Add a delay to ensure the UI updates to show the "Creating new listings..." step
      await delay(1000);

      // Determine which marketplaces to relist on
      let marketplacesToRelist: string[] = [];

      // If we successfully cancelled any listings, use those marketplaces
      if (cancelledMarketplaces.size > 0) {
        marketplacesToRelist = [...cancelledMarketplaces].filter(id =>
          selectedMarketplaces.includes(id)
        );
      }

      // If no marketplaces were successfully cancelled but user selected some,
      // use the selected marketplaces that match the original ones
      if (marketplacesToRelist.length === 0 && selectedMarketplaces.length > 0) {
        marketplacesToRelist = selectedMarketplaces.filter(id =>
          originalMarketplaces.has(id)
        );
      }

      // If still no marketplaces, use all selected marketplaces as a fallback
      if (marketplacesToRelist.length === 0) {
        console.log('No marketplaces were successfully cancelled. Using selected marketplaces instead.');
        marketplacesToRelist = [...selectedMarketplaces];
      }

      console.log('Marketplaces to relist on:', marketplacesToRelist);

      // Format NFTs for the NFTGo API
      const nftsForListing = [{
        token: `${nft.contractAddress}:${nft.tokenId}`,
        price
      }];

      // Calculate expiration time in seconds from now
      const expiration_time = Math.floor(Date.now() / 1000 + duration * 24 * 60 * 60).toString();
      const listing_time = Math.floor(Date.now() / 1000).toString();

      // Define marketplace configurations
      const marketplaceConfig = {
        opensea: {
          orderbook: 'opensea',
          order_kind: 'seaport-v1.6',
        },
        looksrare: {
          orderbook: 'looks-rare',
          order_kind: 'looks-rare-v2',
        },
        blur: {
          orderbook: 'blur',
          order_kind: 'blur',
        },
        nftgo: {
          orderbook: 'nftgo',
          order_kind: 'seaport-v1.5',
        }
      };

      // Call the NFTGo API to create new listings
      setCurrentStep('Preparing new listing...');

      // Add a delay to ensure the UI updates to show the "Preparing new listing..." step
      await delay(500);

      const result = await fetch('/api/nftgo/trade/create-listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maker: address,
          params: nftsForListing.flatMap(nft =>
            marketplacesToRelist.map(marketplace => {
              const config = marketplaceConfig[marketplace as keyof typeof marketplaceConfig];

              if (!config) {
                console.warn(`No configuration found for marketplace: ${marketplace}`);
                return null;
              }

              return {
                token: nft.token,
                quantity: 1,
                wei_price: (parseFloat(nft.price) * 1e18).toString(),
                order_kind: config.order_kind,
                orderbook: config.orderbook,
                listing_time,
                expiration_time,
                automated_royalties: config.orderbook === 'opensea' ? true : false,
              };
            }).filter(Boolean) // Remove null entries
          )
        }),
      });

      if (!result.ok) {
        const errorData = await result.json();
        throw new Error(errorData.error || 'Failed to create listing');
      }

      const apiResponse = await result.json();
      console.log('API response:', apiResponse);

      // Validate the response structure
      if (!apiResponse || apiResponse.code !== 'SUCCESS') {
        console.warn('Invalid response format from check post-order results:', apiResponse);
        throw new Error('Invalid response received from listing API.');
      }

      const actions = apiResponse.data.actions;
      setTotalSteps(actions.length);

      // Store signature in a local variable to avoid React state timing issues
      let currentSignature: string | null = null;

      // Track the current marketplace being processed
      let currentMarketplace: string | null = null;

      // Process actions sequentially
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        setProcessingStep(i + 1);
        setCurrentStep(`${action.description || 'Processing step ' + (i + 1)}`);

        // Add a small delay to ensure UI updates before proceeding
        await delay(300);

        try {
          if (action.kind === 'signature') {
            // Handle signature action
            setCurrentStep(`Waiting for wallet signature...`);

            // Add a small delay to ensure UI updates before proceeding
            await delay(500);

            const signatureData = action.data;

            if (signatureData.sign && signatureData.sign.signatureKind === 'eip712') {
              console.log('Signing EIP712 data');
              const signature = await signTypedDataAsync({
                domain: signatureData.sign.domain,
                types: signatureData.sign.types,
                primaryType: Object.keys(signatureData.sign.types)[0], // Infer primaryType
                message: signatureData.sign.value,
              });

              console.log('Signature obtained:', signature);
              currentSignature = signature;

              // If there's a post endpoint, submit the signature
              if (signatureData.post) {
                setCurrentStep(`Submitting signature...`);
                const postBody = {
                  ...signatureData.post.body,
                  signature
                };

                const postResponse = await fetch(signatureData.post.endpoint, {
                  method: signatureData.post.method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(postBody),
                });

                if (!postResponse.ok) {
                  const errorText = await postResponse.text();
                  throw new Error(`Failed to post signature: ${errorText}`);
                }
              }
            } else {
              throw new Error(`Unsupported signature kind: ${signatureData.sign?.signatureKind || 'unknown'}`);
            }
          } else if (action.kind === 'transaction') {
            // Handle transaction action
            setCurrentStep(`Waiting for wallet transaction...`);
            const txData = action.data;

            // Extract transaction parameters
            let toAddress: `0x${string}` | undefined;
            let txDataHex: `0x${string}` | undefined;
            let txValue: string | undefined;

            if (txData.to) {
              toAddress = txData.to as `0x${string}`;
              txDataHex = txData.data;
              txValue = txData.value;
            } else if (txData.txData) {
              toAddress = txData.txData.to;
              txDataHex = txData.txData.data;
              txValue = txData.txData.value;
            } else if (txData.tx_data) {
              toAddress = txData.tx_data.to;
              txDataHex = txData.tx_data.data;
              txValue = txData.tx_data.value;
            }

            if (!toAddress) {
              throw new Error('Invalid transaction data: missing "to" address');
            }

            try {
              // Send the transaction
              await sendTransactionAsync({
                to: toAddress,
                data: txDataHex,
                value: txValue ? parseEther(txValue) : undefined,
              });

              setCurrentStep(`Waiting for transaction confirmation...`);

              // Add a small delay to ensure UI updates before proceeding
              await delay(500);

              // Wait for confirmation (handled by the useEffect hooks)
            } catch (txError) {
              // Check if this was a user rejection
              const errorMessage = parseErrorMessage(txError);
              const isUserRejection = errorMessage.includes("You've rejected the request");

              if (isUserRejection) {
                // If we have a current marketplace, update its status to failed
                if (currentMarketplace) {
                  updateMarketplaceStatus(currentMarketplace, {
                    status: 'failed',
                    error: errorMessage
                  });
                }

                // Rethrow with the user-friendly message
                throw new Error(errorMessage);
              } else {
                // For other errors, rethrow as is
                throw txError;
              }
            }
          } else if (action.kind === 'pass-through') {
            // Handle pass-through action
            setCurrentStep(`Finalizing listing...`);

            // Add a small delay to ensure UI updates before proceeding
            await delay(500);

            const passData = action.data;

            // Prepare the payload with the signature
            const payload = { ...passData.payload };

            // Determine which marketplace this is for
            if (payload.orderbook) {
              // Find the marketplace ID based on the orderbook
              const marketplace = MARKETPLACES.find(m => m.orderbook === payload.orderbook);
              if (marketplace) {
                currentMarketplace = marketplace.id;
                console.log(`Processing pass-through action for marketplace: ${currentMarketplace}`);

                // Update the marketplace status to processing
                updateMarketplaceStatus(currentMarketplace, {
                  status: 'listing',
                  error: null
                });
              }
            }

            // Add signature to the payload
            if (currentSignature) {
              payload.signature = currentSignature;

              // Handle different order kinds
              if (payload.order && payload.order.kind === 'payment-processor-v2') {
                if (payload.order.data && currentSignature.length >= 132) {
                  const r = '0x' + currentSignature.slice(2, 66);
                  const s = '0x' + currentSignature.slice(66, 130);
                  payload.order.data.r = r;
                  payload.order.data.s = s;
                }
              }

              // Add bulk_data for OpenSea if needed
              if (payload.orderbook === 'opensea' && !payload.bulk_data && payload.order) {
                payload.bulk_data = {
                  order: payload.order,
                  signature: currentSignature,
                  order_index: passData.order_indexes ? passData.order_indexes[0] : 0
                };
              }
            }

            // Make the API call
            const endpoint = `/api/nftgo/trade/v1/nft/post-order`;
            const postOrderResponse = await fetch(endpoint, {
              method: passData.method || 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!postOrderResponse.ok) {
              const errorText = await postOrderResponse.text();

              // If we have a current marketplace, update its status to failed
              if (currentMarketplace) {
                updateMarketplaceStatus(currentMarketplace, {
                  status: 'failed',
                  error: `Failed to finalize listing: ${errorText}`
                });
              }

              // Continue with other marketplaces instead of throwing an error
              console.error(`Failed to finalize listing for ${currentMarketplace}: ${errorText}`);
              continue;
            }

            const postOrderData = await postOrderResponse.json();

            // Check for request_id and start polling
            if (postOrderData.code === 'SUCCESS' && postOrderData.data?.request_id) {
              const currentRequestId = postOrderData.data.request_id;

              // If we have a current marketplace, start polling for it
              if (currentMarketplace) {
                console.log(`Starting polling for ${currentMarketplace} with request ID: ${currentRequestId}`);
                startPollingForMarketplace(currentMarketplace, currentRequestId);

                // We'll set success only when polling completes successfully
                // The polling function will handle setting success state
              }
            } else {
              // If we have a current marketplace, update its status to failed
              if (currentMarketplace) {
                updateMarketplaceStatus(currentMarketplace, {
                  status: 'failed',
                  error: `Failed to finalize listing: ${postOrderData.msg || 'Unknown error'}`
                });
              } else {
                throw new Error(`Failed to finalize listing: ${postOrderData.msg || 'Unknown error'}`);
              }
            }
          } else {
            throw new Error(`Unsupported action kind: ${action.kind}`);
          }
        } catch (stepError) {
          console.error(`Error during step ${i + 1}:`, stepError);

          // If we have a current marketplace, update its status to failed
          if (currentMarketplace) {
            updateMarketplaceStatus(currentMarketplace, {
              status: 'failed',
              error: `Failed at step ${i + 1}: ${parseErrorMessage(stepError)}`
            });

            // Continue with other marketplaces instead of throwing an error
            console.error(`Failed at step ${i + 1} for ${currentMarketplace}: ${parseErrorMessage(stepError)}`);
            continue;
          } else {
            throw new Error(`Failed at step ${i + 1}: ${parseErrorMessage(stepError)}`);
          }
        }
      }

      // Check if any marketplace has succeeded
      const anySuccess = marketplaceStatuses.some(status => status.status === 'success');

      // Check if all marketplaces have already completed (success or failed)
      const allCompleted = marketplaceStatuses.length > 0 &&
                          marketplaceStatuses.every(status =>
                            status.status === 'success' || status.status === 'failed'
                          );

      if (anySuccess) {
        // If any marketplace has succeeded, we can consider the operation successful
        setSuccess(true);
        setCurrentStep('Listing Updated Successfully!');
        console.log('At least one marketplace succeeded immediately. Showing success UI.');

        // Always set isSubmitting to false when any marketplace succeeds
        // This allows the user to close the modal without warnings
        setIsSubmitting(false);
        console.log('Setting isSubmitting to false because at least one marketplace succeeded immediately');

        // If all marketplaces have completed, we can stop polling completely
        if (allCompleted) {
          console.log('All marketplaces completed processing immediately. Stopping all polling.');
        } else {
          console.log('Some marketplaces still processing, but at least one succeeded. Continuing to poll for others in the background.');
        }

        // Refresh listings data
        await refreshUserListings();
        refreshNFTs();
      } else if (allCompleted) {
        // All marketplaces have completed but none succeeded
        setIsSubmitting(false);
        setError('All marketplace listings failed. Please try again.');
        setCurrentStep('Listing update failed');
        console.log('All marketplaces completed processing immediately. All failed.');

        // Refresh listings data
        await refreshListings();
        refreshNFTs();
      } else {
        // Some marketplaces are still processing and none have succeeded yet
        console.log('Some marketplaces are still processing, waiting for completion...');
      }

    } catch (err) {
      console.error('Error updating listing:', err);
      setError(parseErrorMessage(err));
      setCurrentStep('Listing update failed');
      setIsSubmitting(false);
    }
  };

  // Duration options
  const durationOptions = [
    { value: 1, label: '1 day' },
    { value: 3, label: '3 days' },
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
  ];

  if (!isOpen || !nft) return null;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleClose}
          />

          <motion.div
            className="relative w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
              opacity: { duration: 0.25 }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Edit NFT Listing</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Update your price and duration
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="p-1"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center space-x-4 mb-6">
              <div className="relative h-16 w-16 rounded-lg overflow-hidden flex-shrink-0">
                {nft.image ? (
                  <img
                    src={nft.image}
                    alt={nft.name || 'NFT'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                    <span className="text-xs text-zinc-500">No Image</span>
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-medium">{nft.name}</h4>
                {nft.collection && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {nft.collection.name}
                  </p>
                )}
              </div>
            </div>

            {/* Current listings */}
            {currentListings.length > 0 && (
              <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Current Listings</h4>
                <div className="space-y-2">
                  {currentListings.map((listing, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            listing.marketplace.toLowerCase().includes('opensea')
                              ? 'https://static.nftgo.io/marketplace/Opensea.svg'
                              : listing.marketplace.toLowerCase().includes('looksrare')
                              ? 'https://static-image.nftgo.io/marketplace/looksrare.svg'
                              : 'https://files.readme.io/cdb645a-Vertical.svg'
                          }
                          alt={listing.marketplace}
                          className="w-4 h-4"
                        />
                        <span>{listing.marketplace.toUpperCase()}</span>
                      </div>
                      <div className="font-medium">{listing.price} ETH</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form */}
            {!isSubmitting && !success ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}>
                <div className="space-y-4">
                  {/* Price input */}
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium mb-1">
                      New Price
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 text-zinc-500 flex items-center pointer-events-none">
                        {chain?.nativeCurrency.symbol || 'ETH'}
                      </div>
                      <input
                        type="number"
                        id="price"
                        placeholder="0.00"
                        step="0.000001"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="pl-11 pr-4 py-2 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Price change information or warning if price is the same */}
                    <AnimatePresence mode="wait">
                      {initialPrice && price && (
                        <>
                          {parseFloat(price) === parseFloat(initialPrice) ? (
                            <motion.div
                              key="same-price-warning"
                              initial={{ opacity: 0, y: -10, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: 'auto' }}
                              exit={{ opacity: 0, y: -10, height: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 overflow-hidden"
                            >
                              <div className="flex items-center text-sm">
                                <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                                <span className="text-zinc-700 dark:text-zinc-300">
                                  Please enter a different price than the current listing price.
                                </span>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="price-change-info"
                              initial={{ opacity: 0, y: -10, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: 'auto' }}
                              exit={{ opacity: 0, y: -10, height: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="mt-2 p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 overflow-hidden"
                            >
                              <div className="flex items-center text-sm">
                                <ArrowRightLeft className="h-4 w-4 mr-2 text-blue-500" />
                                <span className="text-zinc-700 dark:text-zinc-300">
                                  Updating price from <span className="font-semibold">{initialPrice} ETH</span> to <span className="font-semibold">{price} ETH</span>
                                  {parseFloat(price || '0') > parseFloat(initialPrice) ? (
                                    <span className="ml-1 text-green-600 dark:text-green-400">
                                      (+{(parseFloat(price || '0') - parseFloat(initialPrice)).toFixed(3)} ETH)
                                    </span>
                                  ) : parseFloat(price || '0') < parseFloat(initialPrice) ? (
                                    <span className="ml-1 text-red-600 dark:text-red-400">
                                      (-{(parseFloat(initialPrice) - parseFloat(price || '0')).toFixed(3)} ETH)
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </>
                      )}
                    </AnimatePresence>

                    {/* Fee breakdown and You Receive section - only show if price is different */}
                    <AnimatePresence>
                      {price && parseFloat(price) > 0 && (!initialPrice || parseFloat(price) !== parseFloat(initialPrice)) && (
                        <motion.div
                          key="fee-breakdown"
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 20, scale: 0.95 }}
                          transition={{
                            duration: 0.4,
                            ease: [0.4, 0, 0.2, 1],
                            delay: 0.1
                          }}
                          className="mt-4 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                        >
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.3 }}
                            className="flex justify-between items-center mb-2"
                          >
                            <h4 className="text-sm font-medium">You Receive</h4>
                            <div className="flex items-center">
                              {(() => {
                                // Calculate fees based on marketplace
                                const priceValue = parseFloat(price);

                                // Get marketplace fees
                                const marketplaceFees = selectedMarketplaces.map(marketplace => {
                                  if (marketplace === 'opensea' || marketplace === 'looksrare') {
                                    return priceValue * 0.025; // 2.5% fee
                                  } else if (marketplace === 'nftgo') {
                                    return priceValue * 0.015; // 1.5% fee
                                  } else if (marketplace === 'blur') {
                                    return 0; // 0% fee
                                  }
                                  return 0;
                                });

                                // Use the highest fee if multiple marketplaces
                                const marketplaceFee = Math.max(...marketplaceFees);

                                // Get royalty fee (default to 0% if not available)
                                // In a real implementation, this would come from the NFT's extra_rarity_info
                                const royaltyFee = nft?.metadata?.royaltyFee
                                  ? parseFloat(nft.metadata.royaltyFee) * priceValue / 100
                                  : 0;

                                // Calculate total fees
                                const totalFees = marketplaceFee + royaltyFee;

                                // Calculate what seller receives
                                const sellerReceives = priceValue - totalFees;

                                return (
                                  <motion.span
                                    className="text-lg font-semibold"
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                                  >
                                    {sellerReceives.toFixed(4)} {chain?.nativeCurrency.symbol || 'ETH'}
                                  </motion.span>
                                );
                              })()}
                            </div>
                          </motion.div>

                          <motion.div
                            className="space-y-1.5 text-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.3 }}
                          >
                            <motion.div
                              className="flex justify-between"
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: 0.35 }}
                            >
                              <span className="text-zinc-500">Total</span>
                              <span>{parseFloat(price).toFixed(4)} {chain?.nativeCurrency.symbol || 'ETH'}</span>
                            </motion.div>

                            {selectedMarketplaces.map((marketplace, index) => {
                              let feePercentage = 0;
                              let feeName = '';

                              if (marketplace === 'opensea') {
                                feePercentage = 2.5;
                                feeName = 'OpenSea Fee';
                              } else if (marketplace === 'looksrare') {
                                feePercentage = 2.5;
                                feeName = 'LooksRare Fee';
                              } else if (marketplace === 'nftgo') {
                                feePercentage = 1.5;
                                feeName = 'NFTGo Fee';
                              } else if (marketplace === 'blur') {
                                feePercentage = 0;
                                feeName = 'Blur Fee';
                              }

                              const feeAmount = parseFloat(price) * (feePercentage / 100);

                              return (
                                <motion.div
                                  key={marketplace}
                                  className="flex justify-between"
                                  initial={{ x: -10, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: 0.4 + (index * 0.05) }}
                                >
                                  <span className="text-zinc-500">{feeName} ({feePercentage}%)</span>
                                  <span>-{feeAmount.toFixed(4)} {chain?.nativeCurrency.symbol || 'ETH'}</span>
                                </motion.div>
                              );
                            })}

                            {/* Royalty fee - would come from NFT metadata in real implementation */}
                            {nft?.metadata?.royaltyFee ? (
                              <motion.div
                                className="flex justify-between"
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 + (selectedMarketplaces.length * 0.05) }}
                              >
                                <span className="text-zinc-500">Creator Royalty ({nft.metadata.royaltyFee}%)</span>
                                <span>-{(parseFloat(price) * parseFloat(nft.metadata.royaltyFee) / 100).toFixed(4)} {chain?.nativeCurrency.symbol || 'ETH'}</span>
                              </motion.div>
                            ) : (
                              <motion.div
                                className="flex justify-between"
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 + (selectedMarketplaces.length * 0.05) }}
                              >
                                <span className="text-zinc-500">Creator Royalty (0%)</span>
                                <span>-0.0000 {chain?.nativeCurrency.symbol || 'ETH'}</span>
                              </motion.div>
                            )}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Duration selection */}
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium mb-1">
                      Duration
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock className="h-4 w-4 text-zinc-500" />
                      </div>
                      <select
                        id="duration"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="pl-8 pr-4 py-2 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {durationOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Marketplace selection */}
                  <div>
                    <label htmlFor="marketplace" className="block text-sm font-medium mb-1">
                      Current Marketplaces
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Only show marketplaces where the NFT is currently listed */}
                      {activeMarketplaces.length > 0 ? (
                        // Filter MARKETPLACES to only include those in activeMarketplaces
                        MARKETPLACES.filter(marketplace =>
                          activeMarketplaces.includes(marketplace.id)
                        ).map((marketplace) => {
                          const isSelected = selectedMarketplaces.includes(marketplace.id);

                          // Get the correct logo from marketplaceInfo if available
                          const marketplaceDetails = marketplaceInfo[marketplace.id] || {
                            logo: marketplace.logo,
                            name: marketplace.name
                          };

                          return (
                            <button
                              key={marketplace.id}
                              type="button"
                              onClick={() => {
                                // For edit modal, we don't allow deselecting marketplaces
                                // where the NFT is already listed - we want to update all of them
                                if (!isSelected) {
                                  setSelectedMarketplaces([...selectedMarketplaces, marketplace.id]);
                                }
                                // Clicking an already selected marketplace does nothing
                              }}
                              className={`flex flex-col items-center justify-center p-3 rounded-lg border relative ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                <Check className="h-3 w-3" />
                              </div>
                              <img
                                src={marketplaceDetails.logo}
                                alt={marketplaceDetails.name}
                                className="w-6 h-6 mb-1"
                              />
                              <span className="text-xs font-medium">{marketplaceDetails.name}</span>
                            </button>
                          );
                        })
                      ) : (
                        // If no active marketplaces detected but NFT is listed, show the marketplace from listingInfo
                        isListed && (() => {
                          let marketplaceToShow = 'opensea'; // Default to opensea

                          // Try to determine the marketplace from the listing info
                          if (listingInfo && listingInfo.marketplace) {
                            const marketplaceId = listingInfo.marketplace.toLowerCase();

                            // Find the matching marketplace in our mapping
                            for (const [key, info] of Object.entries(marketplaceInfo)) {
                              if (marketplaceId.includes(key)) {
                                marketplaceToShow = info.id;
                                break;
                              }
                            }
                          }

                          // Get the marketplace info
                          const info = marketplaceInfo[marketplaceToShow] || {
                            logo: 'https://static.nftgo.io/marketplace/Opensea.svg',
                            name: 'OpenSea',
                            id: 'opensea'
                          };

                          return (
                            <button
                              key={info.id}
                              type="button"
                              className="flex flex-col items-center justify-center p-3 rounded-lg border relative border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            >
                              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                <Check className="h-3 w-3" />
                              </div>
                              <img
                                src={info.logo}
                                alt={info.name}
                                className="w-6 h-6 mb-1"
                              />
                              <span className="text-xs font-medium">{info.name}</span>
                            </button>
                          );
                        })()
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {isListed ?
                        "Your NFT will be updated on all marketplaces where it's currently listed." :
                        "No active listings found for this NFT."}
                    </p>
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    </div>
                  )}

                  {/* Submit button */}
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                    disabled={Boolean(
                      !price ||
                      parseFloat(price) <= 0 ||
                      selectedMarketplaces.length === 0 ||
                      (initialPrice && parseFloat(price) === parseFloat(initialPrice))
                    )}
                  >
                    Update Listing
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Processing state - only show if no marketplace has succeeded yet */}
                {isSubmitting && !marketplaceStatuses.some(status => status.status === 'success') && !error && (
                  <div className="flex flex-col items-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                    <h4 className="text-lg font-medium mb-2">Processing</h4>
                    <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 mb-2">
                      {currentStep || 'Preparing your listing update...'}
                    </p>

                    {/* Price change information during processing - only if price is different */}
                    <AnimatePresence>
                      {initialPrice && price && parseFloat(price) !== parseFloat(initialPrice) && (
                        <motion.div
                          key="price-change-processing"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="mt-2 mb-3 p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 w-full max-w-xs"
                        >
                          <div className="flex items-center text-sm justify-center">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2 text-blue-500" />
                            </motion.div>
                            <span className="text-zinc-700 dark:text-zinc-300">
                              Updating price from <span className="font-semibold">{initialPrice} ETH</span> to <span className="font-semibold">{price} ETH</span>
                              {parseFloat(price || '0') > parseFloat(initialPrice) ? (
                                <span className="ml-1 text-green-600 dark:text-green-400">
                                  (+{(parseFloat(price || '0') - parseFloat(initialPrice)).toFixed(3)} ETH)
                                </span>
                              ) : parseFloat(price || '0') < parseFloat(initialPrice) ? (
                                <span className="ml-1 text-red-600 dark:text-red-400">
                                  (-{(parseFloat(initialPrice) - parseFloat(price || '0')).toFixed(3)} ETH)
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Fee breakdown during processing - only if price is different */}
                    <AnimatePresence>
                      {price && parseFloat(price) > 0 && (!initialPrice || parseFloat(price) !== parseFloat(initialPrice)) && (
                        <motion.div
                          key="fee-breakdown-processing"
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
                          className="mt-2 mb-3 p-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 w-full max-w-xs"
                        >
                          <motion.div
                            className="flex justify-between items-center mb-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                          >
                            <h4 className="text-sm font-medium">You Receive</h4>
                            <div className="flex items-center">
                              {(() => {
                                // Calculate fees based on marketplace
                                const priceValue = parseFloat(price);

                                // Get marketplace fees
                                const marketplaceFees = marketplaceStatuses.map(marketplace => {
                                  if (marketplace.id === 'opensea' || marketplace.id === 'looksrare') {
                                    return priceValue * 0.025; // 2.5% fee
                                  } else if (marketplace.id === 'nftgo') {
                                    return priceValue * 0.015; // 1.5% fee
                                  } else if (marketplace.id === 'blur') {
                                    return 0; // 0% fee
                                  }
                                  return 0;
                                });

                                // Use the highest fee if multiple marketplaces
                                const marketplaceFee = marketplaceFees.length > 0 ? Math.max(...marketplaceFees) : 0;

                                // Get royalty fee (default to 0% if not available)
                                const royaltyFee = nft?.metadata?.royaltyFee
                                  ? parseFloat(nft.metadata.royaltyFee) * priceValue / 100
                                  : 0;

                                // Calculate total fees
                                const totalFees = marketplaceFee + royaltyFee;

                                // Calculate what seller receives
                                const sellerReceives = priceValue - totalFees;

                                return (
                                  <motion.span
                                    className="text-base font-semibold"
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                                  >
                                    {sellerReceives.toFixed(4)} {chain?.nativeCurrency.symbol || 'ETH'}
                                  </motion.span>
                                );
                              })()}
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {totalSteps > 0 && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        Step {processingStep} of {totalSteps}
                      </p>
                    )}
                  </div>
                )}

                {/* Debug message for marketplace statuses */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-500 mb-2">
                    <p>Debug: {marketplaceStatuses.map(s => `${s.id}:${s.status}`).join(', ')}</p>
                    <p>isSubmitting: {isSubmitting ? 'true' : 'false'}, success: {success ? 'true' : 'false'}</p>
                  </div>
                )}

                {/* Marketplace statuses */}
                {marketplaceStatuses.length > 0 && (isSubmitting || success || error) && (
                  <div className="space-y-3 mt-4">
                    <h4 className="text-sm font-medium">Marketplace Status</h4>
                    {marketplaceStatuses.map((marketplace) => (
                      <div
                        key={marketplace.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={marketplace.logo}
                            alt={marketplace.name}
                            className="w-5 h-5"
                          />
                          <span className="text-sm font-medium">{marketplace.name}</span>
                        </div>
                        <div className="flex items-center">
                          {marketplace.status === 'idle' && (
                            <span className="text-xs text-zinc-500">Waiting...</span>
                          )}
                          {marketplace.status === 'canceling' && (
                            <div className="flex items-center">
                              <Loader2 className="h-3 w-3 animate-spin mr-1 text-yellow-500" />
                              <span className="text-xs text-yellow-500">Canceling...</span>
                            </div>
                          )}
                          {marketplace.status === 'canceled' && (
                            <div className="flex items-center">
                              <CheckCircle className="h-3 w-3 mr-1 text-yellow-500" />
                              <span className="text-xs text-yellow-500">Canceled</span>
                            </div>
                          )}
                          {marketplace.status === 'listing' && (
                            <div className="flex items-center">
                              <Loader2 className="h-3 w-3 animate-spin mr-1 text-blue-500" />
                              <span className="text-xs text-blue-500">Listing...</span>
                            </div>
                          )}
                          {marketplace.status === 'success' && (
                            <div className="flex items-center">
                              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                              <span className="text-xs text-green-500">Success</span>
                            </div>
                          )}
                          {marketplace.status === 'failed' && (
                            <div className="flex items-center">
                              <XCircle className="h-3 w-3 mr-1 text-red-500" />
                              <span className="text-xs text-red-500">Failed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Success state - show when at least one marketplace has succeeded */}
                {marketplaceStatuses.some(status => status.status === 'success') && (
                  <div className="flex flex-col items-center py-4">
                    <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3 mb-4">
                      <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">Listing Updated!</h4>
                    <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 mb-2">
                      Your NFT listing has been successfully updated on the marketplace{marketplaceStatuses.filter(s => s.status === 'success').length > 1 ? 's' : ''}.
                    </p>

                    {/* Price change information in success state - only if price is different */}
                    <AnimatePresence>
                      {initialPrice && price && parseFloat(price) !== parseFloat(initialPrice) && (
                        <motion.div
                          key="price-change-success"
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                          className="mt-2 mb-2 p-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 w-full max-w-xs"
                        >
                          <div className="flex items-center text-sm justify-center">
                            <motion.div
                              initial={{ rotate: 0, scale: 0 }}
                              animate={{ rotate: 360, scale: 1 }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2 text-green-500" />
                            </motion.div>
                            <span className="text-zinc-700 dark:text-zinc-300">
                              Price updated from <span className="font-semibold">{initialPrice} ETH</span> to <span className="font-semibold">{price} ETH</span>
                              {parseFloat(price || '0') > parseFloat(initialPrice) ? (
                                <span className="ml-1 text-green-600 dark:text-green-400">
                                  (+{(parseFloat(price || '0') - parseFloat(initialPrice)).toFixed(3)} ETH)
                                </span>
                              ) : parseFloat(price || '0') < parseFloat(initialPrice) ? (
                                <span className="ml-1 text-red-600 dark:text-red-400">
                                  (-{(parseFloat(initialPrice) - parseFloat(price || '0')).toFixed(3)} ETH)
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Fee breakdown in success state - only if price is different */}
                    <AnimatePresence>
                      {price && parseFloat(price) > 0 && (!initialPrice || parseFloat(price) !== parseFloat(initialPrice)) && (
                        <motion.div
                          key="fee-breakdown-success"
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 20, scale: 0.95 }}
                          transition={{
                            duration: 0.5,
                            ease: [0.4, 0, 0.2, 1],
                            delay: 0.2
                          }}
                          className="mb-4 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 w-full max-w-xs overflow-hidden"
                        >
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.3 }}
                            className="flex justify-between items-center mb-2"
                          >
                            <h4 className="text-sm font-medium text-green-800 dark:text-green-300">You Receive</h4>
                            <div className="flex items-center">
                              {(() => {
                                // Calculate fees based on marketplace
                                const priceValue = parseFloat(price);

                                // Get marketplace fees from successful marketplaces
                                const successfulMarketplaces = marketplaceStatuses.filter(m => m.status === 'success');
                                const marketplaceFees = successfulMarketplaces.map(marketplace => {
                                  if (marketplace.id === 'opensea' || marketplace.id === 'looksrare') {
                                    return priceValue * 0.025; // 2.5% fee
                                  } else if (marketplace.id === 'nftgo') {
                                    return priceValue * 0.015; // 1.5% fee
                                  } else if (marketplace.id === 'blur') {
                                    return 0; // 0% fee
                                  }
                                  return 0;
                                });

                                // Use the highest fee if multiple marketplaces
                                const marketplaceFee = marketplaceFees.length > 0 ? Math.max(...marketplaceFees) : 0;

                                // Get royalty fee (default to 0% if not available)
                                const royaltyFee = nft?.metadata?.royaltyFee
                                  ? parseFloat(nft.metadata.royaltyFee) * priceValue / 100
                                  : 0;

                                // Calculate total fees
                                const totalFees = marketplaceFee + royaltyFee;

                                // Calculate what seller receives
                                const sellerReceives = priceValue - totalFees;

                                return (
                                  <motion.span
                                    className="text-base font-semibold text-green-800 dark:text-green-300"
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    transition={{
                                      delay: 0.4,
                                      type: "spring",
                                      stiffness: 200
                                    }}
                                  >
                                    {sellerReceives.toFixed(4)} {chain?.nativeCurrency.symbol || 'ETH'}
                                  </motion.span>
                                );
                              })()}
                            </div>
                          </motion.div>

                          <motion.div
                            className="space-y-1 text-sm text-green-700 dark:text-green-400"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.3 }}
                          >
                            <motion.div
                              className="flex justify-between"
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: 0.45 }}
                            >
                              <span>Total</span>
                              <span>{parseFloat(price).toFixed(4)} {chain?.nativeCurrency.symbol || 'ETH'}</span>
                            </motion.div>

                            {marketplaceStatuses.filter(m => m.status === 'success').map((marketplace, index) => {
                              let feePercentage = 0;
                              let feeName = '';

                              if (marketplace.id === 'opensea') {
                                feePercentage = 2.5;
                                feeName = 'OpenSea Fee';
                              } else if (marketplace.id === 'looksrare') {
                                feePercentage = 2.5;
                                feeName = 'LooksRare Fee';
                              } else if (marketplace.id === 'nftgo') {
                                feePercentage = 1.5;
                                feeName = 'NFTGo Fee';
                              } else if (marketplace.id === 'blur') {
                                feePercentage = 0;
                                feeName = 'Blur Fee';
                              }

                              const feeAmount = parseFloat(price) * (feePercentage / 100);

                              return (
                                <motion.div
                                  key={marketplace.id}
                                  className="flex justify-between"
                                  initial={{ x: -10, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: 0.5 + (index * 0.05) }}
                                >
                                  <span>{feeName} ({feePercentage}%)</span>
                                  <span>-{feeAmount.toFixed(4)} {chain?.nativeCurrency.symbol || 'ETH'}</span>
                                </motion.div>
                              );
                            })}

                            {/* Royalty fee - would come from NFT metadata in real implementation */}
                            {nft?.metadata?.royaltyFee ? (
                              <motion.div
                                className="flex justify-between"
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{
                                  delay: 0.6 + (marketplaceStatuses.filter(m => m.status === 'success').length * 0.05)
                                }}
                              >
                                <span>Creator Royalty ({nft.metadata.royaltyFee}%)</span>
                                <span>-{(parseFloat(price) * parseFloat(nft.metadata.royaltyFee) / 100).toFixed(4)} {chain?.nativeCurrency.symbol || 'ETH'}</span>
                              </motion.div>
                            ) : (
                              <motion.div
                                className="flex justify-between"
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{
                                  delay: 0.6 + (marketplaceStatuses.filter(m => m.status === 'success').length * 0.05)
                                }}
                              >
                                <span>Creator Royalty (0%)</span>
                                <span>-0.0000 {chain?.nativeCurrency.symbol || 'ETH'}</span>
                              </motion.div>
                            )}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Button
                      onClick={handleClose}
                      className="w-full"
                    >
                      Close
                    </Button>
                  </div>
                )}

                {/* Error state with retry option */}
                {!isSubmitting && error && !success && (
                  <div className="flex flex-col items-center py-4">
                    <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3 mb-4">
                      <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">Something went wrong</h4>
                    <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 mb-4">
                      {error}
                    </p>
                    <div className="flex gap-3 w-full">
                      <Button
                        variant="outline"
                        onClick={handleClose}
                        className="flex-1"
                      >
                        Close
                      </Button>
                      <Button
                        onClick={() => {
                          setError(null);
                          setIsSubmitting(false);
                          // Reset marketplace statuses
                          setMarketplaceStatuses(prev =>
                            prev.map(status => ({
                              ...status,
                              status: 'idle',
                              error: null,
                              requestId: null
                            }))
                          );
                        }}
                        className="flex-1"
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
