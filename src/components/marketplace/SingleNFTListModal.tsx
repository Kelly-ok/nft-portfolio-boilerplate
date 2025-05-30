'use client';

import { NFT } from '@/types';
import { useAccount, useSignTypedData, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { useNFTs } from '@/context/NFTContext';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { X, Clock, Check, Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import Image from 'next/image';
import { parseEther } from 'viem';
import * as NFTGo from '@/services/marketplace/nftgo';

// Helper function to introduce delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to parse error messages into user-friendly format
const parseErrorMessage = (error: any): string => {
  // Handle different error types
  if (typeof error === 'string') {
    error = error;
  } else if (error instanceof Error) {
    error = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    error = (error as any).message;
  }

  // Check for specific error patterns and provide user-friendly messages
  if (error.includes('User rejected the request') ||
    error.includes('Transaction was rejected in your wallet') ||
    error.includes('User denied transaction signature') ||
    error.includes('MetaMask Tx Signature: User denied')) {
    return 'Transaction was rejected in your wallet';
  }

  if (error.includes('insufficient funds')) {
    return 'Insufficient funds in your wallet to complete this transaction';
  }

  if (error.includes('nonce')) {
    return 'Transaction nonce error. Please try again';
  }

  if (error.includes('gas')) {
    return 'Gas estimation failed. The transaction might fail';
  }

  if (error.includes('network') || error.includes('chain')) {
    return 'Network connection issue. Please check your wallet is on the correct network';
  }

  // For step-specific errors, extract just the essential part
  if (error.includes('Failed at step')) {
    // Try to extract just the step description
    const match = error.match(/Failed at step \d+ \(([^)]+)\):(.*)/);
    if (match) {
      const [, stepName, errorDetails] = match;
      // If we have user rejected message in the details, simplify it
      if (errorDetails.includes('User rejected') || errorDetails.includes('User denied')) {
        return `${stepName}: Transaction was rejected in your wallet`;
      }
      // Otherwise return the step name and error details
      return `${stepName}: ${errorDetails.trim()}`;
    }
  }

  return error;
};

// Define types for NFTGo API actions based on documentation/search results
interface NFTGoActionDataBase {
  name: string;
  description: string;
}

interface NFTGoSignatureActionData {
  sign: {
    signatureKind: 'eip712' | string;
    domain: Record<string, any>;
    types: Record<string, any>;
    value: Record<string, any>;
    message?: string;
  };
  post?: {
    endpoint: string;
    method: 'POST' | 'GET';
    body: Record<string, any>;
  };
}

interface NFTGoTransactionActionData {
  from?: `0x${string}`;
  to?: `0x${string}`;
  data?: `0x${string}`;
  value?: string;
  txData?: {
    from: `0x${string}`;
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
  };
  order_indexes?: number[];
  tx_data?: {
    from: `0x${string}`;
    to: `0x${string}`;
    data: `0x${string}`;
    value?: string;
  };
}

interface NFTGoPassThroughActionData {
  endpoint: string;
  method: 'POST' | 'GET' | string;
  payload: Record<string, any>;
  order_indexes?: number[];
}

interface NFTGoSignatureAction extends NFTGoActionDataBase {
  kind: 'signature';
  data: NFTGoSignatureActionData;
}

interface NFTGoTransactionAction extends NFTGoActionDataBase {
  kind: 'transaction';
  data: NFTGoTransactionActionData;
}

interface NFTGoPassThroughAction extends NFTGoActionDataBase {
  kind: 'pass-through';
  data: NFTGoPassThroughActionData;
}

type NFTGoAction = NFTGoSignatureAction | NFTGoTransactionAction | NFTGoPassThroughAction;



// Marketplace status tracking
interface MarketplaceStatus {
  id: string;
  name: string;
  logo: string;
  requestId: string | null;
  status: 'idle' | 'pending' | 'success' | 'failed';
  error: string | null;
  orderbook: string;
  orderKind: string;
}

interface SimpleListModalProps {
  nft: NFT | null;
  nfts?: NFT[]; // Add support for multiple NFTs
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Define marketplace configurations
const MARKETPLACES = [
  {
    id: 'opensea',
    name: 'OpenSea',
    logo: 'https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.svg',
    orderbook: 'opensea',
    orderKind: 'seaport-v1.6'
  },
  {
    id: 'looksrare',
    name: 'LooksRare',
    logo: 'https://storage.swapspace.co/static/font/src/looks.svg',
    orderbook: 'looks-rare',
    orderKind: 'looks-rare-v2'
  },
  {
    id: 'nftgo',
    name: 'NFTGo',
    logo: 'https://files.readme.io/cdb645a-Vertical.svg',
    orderbook: 'nftgo',
    orderKind: 'seaport-v1.5'
  },
];

export default function SimpleListModal({ nft, nfts = [], isOpen, onClose, onSuccess }: SimpleListModalProps) {
  const { refreshUserListings } = useNFTs();
  const { address, chain } = useAccount();
  const [price, setPrice] = useState<string>('');
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
  const [hasAnySuccess, setHasAnySuccess] = useState(false);
  const [hasAllFailed, setHasAllFailed] = useState(false);

  // Polling references
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Wagmi hooks
  const { signTypedDataAsync } = useSignTypedData();
  const { data: txHash, sendTransactionAsync, error: txError } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmationError } = useWaitForTransactionReceipt({ hash: txHash });

  // Get the NFTs to display - either the single NFT or the array of NFTs
  const nftsToList = useMemo(() => {
    if (nfts && nfts.length > 0) {
      return nfts;
    } else if (nft) {
      return [nft];
    }
    return [];
  }, [nft, nfts]);

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

      // Check if any marketplace has succeeded
      const anySuccess = updatedStatuses.some(status => status.status === 'success');
      setHasAnySuccess(anySuccess);

      // Check if all marketplaces have failed
      const allFailed = updatedStatuses.length > 0 &&
                        updatedStatuses.every(status => status.status === 'failed');
      setHasAllFailed(allFailed);

      return updatedStatuses;
    });
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
            // For NFTGo orderbook, we'll handle this in the polling function
            // Just log and return false to continue polling
            console.log(`Order for ${marketplaceId} is still processing (empty post_order_results array)`);

            // Get the marketplace configuration
            const marketplace = marketplaceStatuses.find(m => m.id === marketplaceId);
            const isNFTGoOrderbook = marketplace?.orderbook === 'nftgo';

            // Log if this is NFTGo orderbook for debugging
            if (isNFTGoOrderbook) {
              console.log(`This is an NFTGo orderbook listing - will be considered successful after 5 attempts with empty results`);
            }

            updateMarketplaceStatus(marketplaceId, {
              status: 'pending',
              error: null
            });
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
              await NFTGo.getOrdersByMaker(
                address as string,
                marketplaceStatuses.find(m => m.id === marketplaceId)?.orderbook || undefined,
                3, 1000, true
              );

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
              updateMarketplaceStatus(marketplaceId, {
                status: 'pending',
                error: null
              });
              return false;
            }
          } else {
            // No result found for this request ID
            console.log(`No result found for ${marketplaceId} with request ID ${requestId}`);
            return false;
          }
        } else if (result.data && Array.isArray(result.data.results) && result.data.results.length > 0) {
          // Legacy format handling
          const orderResult = result.data.results[0];

          // Check if the order was successful
          if (orderResult.is_success === true) {
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
            await NFTGo.getOrdersByMaker(
              address as string,
              marketplaceStatuses.find(m => m.id === marketplaceId)?.orderbook || undefined,
              3, 1000, true
            );

            return true;
          } else if (orderResult.error) {
            // Order failed with an error
            console.error(`Order for ${marketplaceId} failed:`, orderResult.error);
            updateMarketplaceStatus(marketplaceId, {
              status: 'failed',
              error: `Listing failed: ${orderResult.error}`
            });

            // Clear the polling interval for this marketplace
            const interval = pollingIntervalsRef.current.get(marketplaceId);
            if (interval) {
              clearInterval(interval);
              pollingIntervalsRef.current.delete(marketplaceId);
            }

            return false;
          }
        }
      }
      return false;
    } catch (error) {
      console.error(`Error checking order status for ${marketplaceId}:`, error);
      return false;
    }
  }, [address, marketplaceStatuses, updateMarketplaceStatus]);



  // State for confirmation dialog
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  // Handle manual close with refresh
  const handleClose = useCallback(() => {
    // If we're in the middle of submitting, show confirmation dialog
    if (isSubmitting && !success) {
      setShowCloseConfirmation(true);
      return;
    }

    // If listing was successful, refresh user listings before closing
    if (success) {
      console.log('Refreshing user listings on manual close...');
      refreshUserListings();

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
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
  }, [isSubmitting, success, refreshUserListings, onClose, onSuccess]);

  // Handle confirmed close
  const handleConfirmedClose = useCallback(() => {
    setShowCloseConfirmation(false);

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
  }, [onClose]);

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
      status: 'pending',
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

      // Check if all marketplaces have completed (success or failed)
      const allCompleted = marketplaceStatuses.every(
        status => status.status === 'success' || status.status === 'failed'
      );

      if (allCompleted) {
        // If all marketplaces have completed, refresh listings and clear all intervals
        await refreshUserListings();

        // Clear all polling intervals
        pollingIntervalsRef.current.forEach((interval) => {
          clearInterval(interval);
        });
        pollingIntervalsRef.current.clear();
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
        // Exception: For NFTGo orderbook, if we've reached maxNFTGoAttempts, mark as success
        const marketplace = marketplaceStatuses.find(m => m.id === marketplaceId);
        if (marketplace && marketplace.status === 'pending') {
          if (marketplace.orderbook === 'nftgo' && attempts >= maxNFTGoAttempts) {
            updateMarketplaceStatus(marketplaceId, {
              status: 'success',
              error: null
            });
            refreshUserListings();
          } else {
            updateMarketplaceStatus(marketplaceId, {
              status: 'failed',
              error: 'Listing timed out. Please check the marketplace directly.'
            });
          }
        }
      }
    }, 120000); // 2 minute timeout
  }, [checkMarketplaceStatus, marketplaceStatuses, refreshUserListings, updateMarketplaceStatus]);



  // Function to update marketplace statuses based on selected marketplaces
  const updateMarketplaceStatusesFromSelection = useCallback(() => {
    if (isSubmitting) return; // Skip if submitting

    // Create new statuses based on selected marketplaces
    setMarketplaceStatuses(prevStatuses => {
      const newStatuses = selectedMarketplaces.map(id => {
        const marketplace = MARKETPLACES.find(m => m.id === id);
        if (!marketplace) return null;

        // Preserve existing status if available
        const existingStatus = prevStatuses.find(s => s.id === id);

        return {
          id: marketplace.id,
          name: marketplace.name,
          logo: marketplace.logo,
          requestId: existingStatus?.requestId || null,
          status: existingStatus?.status || 'idle' as const,
          error: existingStatus?.error || null,
          orderbook: marketplace.orderbook,
          orderKind: marketplace.orderKind
        };
      }).filter(Boolean) as MarketplaceStatus[];

      return newStatuses;
    });
  }, [selectedMarketplaces, isSubmitting]);

  // Update marketplace statuses when selectedMarketplaces changes
  useEffect(() => {
    updateMarketplaceStatusesFromSelection();
  }, [updateMarketplaceStatusesFromSelection]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrice('');
      setDuration(7);
      setSelectedMarketplaces(['opensea']);
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
      setCurrentStep(null);
      setProcessingStep(0);
      setTotalSteps(0);

      setHasAnySuccess(false);
      setHasAllFailed(false);

      // Initialize marketplace statuses with default selection
      setMarketplaceStatuses([{
        id: 'opensea',
        name: 'OpenSea',
        logo: 'https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.svg',
        requestId: null,
        status: 'idle',
        error: null,
        orderbook: 'opensea',
        orderKind: 'seaport-v1.6'
      }]);

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
    }
  }, [isOpen]);

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
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if we have NFTs to list
    if (nftsToList.length === 0 || !address) {
      setError('Missing NFTs or wallet connection');
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      setError('Please enter a valid price');
      return;
    }

    if (selectedMarketplaces.length === 0) {
      setError('Please select at least one marketplace');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    setCurrentStep('Preparing listing request...');
    setProcessingStep(0);
    setTotalSteps(0);

    try {
      // Format NFTs for the NFTGo API
      const nftsForListing = nftsToList.map(nft => {
        return {
          token: `${nft.contractAddress}:${nft.tokenId}`,
          price
        };
      });

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
        nftgo: {
          orderbook: 'nftgo',
          order_kind: 'seaport-v1.5',
        }
      };

      // 1. Call the backend/service to get the actions
      setCurrentStep('Preparing listing...');
      const result = await fetch('/api/nftgo/trade/create-listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maker: address,
          params: nftsForListing.flatMap(nft =>
            selectedMarketplaces.map(marketplace => {
              const config = marketplaceConfig[marketplace as keyof typeof marketplaceConfig];

              return {
                token: nft.token,
                quantity: 1,
                wei_price: parseEther(nft.price).toString(),
                order_kind: config.order_kind,
                orderbook: config.orderbook,
                listing_time,
                expiration_time,
                automated_royalties: config.orderbook === 'opensea' ? true : false,
              };
            })
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
        // Return a standardized error response
        throw new Error('Invalid response received from listing API.');
      }

      const actions = apiResponse.data.actions;
      setTotalSteps(actions.length);

      // Store signature in a local variable to avoid React state timing issues
      let currentSignature: string | null = null;

      // Track the current marketplace being processed
      let currentMarketplace: string | null = null;

      // 2. Process actions sequentially
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        setProcessingStep(i + 1);
        setCurrentStep(`${action.description || 'Processing step ' + (i + 1)}`);

        try {
          if (action.kind === 'signature') {
            // Handle signature action
            setCurrentStep(`Waiting for wallet signature...`);
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

            // Send the transaction
            await sendTransactionAsync({
              to: toAddress,
              data: txDataHex,
              value: txValue ? parseEther(txValue) : undefined,
            });

            setCurrentStep(`Waiting for transaction confirmation...`);
            // Wait for confirmation (handled by the useEffect hooks)
          } else if (action.kind === 'pass-through') {
            // Handle pass-through action
            setCurrentStep(`Finalizing listing...`);
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
                  status: 'pending',
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

                // Set overall success if at least one marketplace succeeded
                setSuccess(true);
              } else {
                // Legacy code path - will be removed after refactoring
                setCurrentStep(`Verifying listing status...`);

                // Poll for order status
                let attempts = 0;
                const maxAttempts = 10; // Use 10 attempts to give more time for results
                const pollInterval = 3000; // 3 seconds between attempts
                let orderConfirmed = false;

                console.log(`Starting polling for request ID: ${currentRequestId}`);

                while (attempts < maxAttempts && !orderConfirmed) {
                  attempts++;
                  try {
                    console.log(`Polling attempt ${attempts}/${maxAttempts} for request ID: ${currentRequestId}`);
                    const checkResult = await NFTGo.checkPostOrderResults([currentRequestId]);
                    console.log('Check result:', JSON.stringify(checkResult, null, 2));

                    if (checkResult && checkResult.code === 'SUCCESS') {
                      // Check if there are post_order_results
                      if (checkResult.data && Array.isArray(checkResult.data.post_order_results)) {
                        // If post_order_results is empty, we need to continue polling until we get results
                        if (checkResult.data.post_order_results.length === 0) {
                          console.log('Empty post_order_results array, continuing to poll...');
                          // For NFTGo orderbook specifically, consider it a success after 5 attempts with empty results
                          if (attempts >= 5 && payload.orderbook === 'nftgo') {
                            console.log('5 attempts reached with empty results for NFTGo orderbook - considering it a successful listing');
                            await refreshUserListings();
                            orderConfirmed = true;
                            setSuccess(true);
                            setCurrentStep('Listing Successful on NFTGo!');
                            setIsSubmitting(false);
                            break;
                          }
                          // For other orderbooks, continue polling until max attempts
                          else if (attempts >= maxAttempts) {
                            console.log('Max attempts reached with empty results, setting to pending state');
                            setCurrentStep('Listing submitted, waiting for marketplace confirmation...');
                            setIsSubmitting(false);
                          }
                        } else {
                          // Find the result for this request ID
                          const orderResult = checkResult.data.post_order_results.find(
                            (r: any) => r.request_id === currentRequestId
                          );

                          if (orderResult) {
                            // Check the status of the order
                            if (orderResult.status === 'success') {
                              console.log('Listing successful!', orderResult);
                              await refreshUserListings();
                              orderConfirmed = true;
                              setSuccess(true);
                              setCurrentStep('Listing Successful!');
                              setIsSubmitting(false);
                              break;
                            } else if (orderResult.status === 'failed') {
                              // Order failed with an error
                              console.error('Listing failed:', orderResult);
                              setError(`Listing failed: ${orderResult.status_reason || 'Unknown error'}`);
                              setCurrentStep('Listing failed');
                              setIsSubmitting(false);
                              break;
                            } else if (orderResult.status === 'pending') {
                              // Order is still pending
                              console.log('Order is still pending, will check again later');
                              // Continue polling - don't break the loop
                              if (attempts >= maxAttempts) {
                                console.log('Max attempts reached with pending status, setting to pending state');
                                setCurrentStep('Listing submitted, waiting for marketplace confirmation...');
                                setIsSubmitting(false);
                              }
                            }
                          } else {
                            // No result found for this request ID
                            console.log(`No result found for request ID ${currentRequestId}`);
                            // Continue polling - don't break the loop
                          }
                        }
                      } else {
                        // If the response structure is different, we can't determine success
                        // Just log and continue polling
                        console.log('Response structure different than expected, continuing to poll...');
                        if (attempts >= maxAttempts) {
                          console.log('Max attempts reached with unexpected response structure, setting to pending state');
                          setCurrentStep('Listing submitted, waiting for marketplace confirmation...');
                          setIsSubmitting(false);
                        }
                      }
                    }
                    // Wait before next poll
                    await delay(pollInterval);
                  } catch (pollError) {
                    console.error(`Error during polling attempt ${attempts}:`, pollError);
                    // Don't throw an error, just log it and continue polling
                    if (attempts >= maxAttempts) {
                      console.log('Max attempts reached with polling errors, setting to pending state');
                      setCurrentStep('Listing submitted, waiting for marketplace confirmation...');
                      setIsSubmitting(false);
                    }
                    await delay(pollInterval);
                  }
                }

                // If we've reached max attempts without confirmation, show a pending message
                if (!orderConfirmed && attempts >= maxAttempts) {
                  console.log('Max polling attempts reached without confirmation');
                  setCurrentStep('Listing submitted, waiting for marketplace confirmation...');
                  setIsSubmitting(false); // Stop the submitting state to show pending UI
                }
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

      // Set isSubmitting to false after all actions are processed
      setIsSubmitting(false);

      // Check if any marketplace succeeded
      const anySuccess = marketplaceStatuses.some(status => status.status === 'success');
      if (anySuccess) {
        setSuccess(true);
        setCurrentStep('Listing Successful!');
        await refreshUserListings();
      }

      // Check if all marketplaces failed
      const allFailed = marketplaceStatuses.length > 0 &&
                        marketplaceStatuses.every(status => status.status === 'failed');
      if (allFailed) {
        setError('All marketplace listings failed. Please try again.');
        setCurrentStep('Listing failed');
      }

    } catch (err) {
      console.error('Error creating listing:', err);
      setError(parseErrorMessage(err));
      setCurrentStep('Listing failed');
      setIsSubmitting(false);
    }
  }, [nftsToList, address, price, duration, selectedMarketplaces, refreshUserListings, signTypedDataAsync, sendTransactionAsync, updateMarketplaceStatus, marketplaceStatuses, startPollingForMarketplace]);

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
                <h3 className="text-lg font-semibold">List NFT</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Set your price and duration
                </p>
                <p className="text-xs text-blue-500 mt-1">
                  Your NFT will be listed on selected marketplaces
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
                {nftsToList.length > 0 && nftsToList[0].image ? (
                  <Image
                    src={nftsToList[0].image}
                    alt={nftsToList[0].name || 'NFT'}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                    <span className="text-xs text-zinc-500">No Image</span>
                  </div>
                )}
                {nftsToList.length > 1 && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-bl-md">
                    +{nftsToList.length - 1}
                  </div>
                )}
              </div>
              <div>
                {nftsToList.length === 1 ? (
                  <>
                    <h4 className="font-medium">{nftsToList[0].name}</h4>
                    {nftsToList[0].collection && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {nftsToList[0].collection.name}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h4 className="font-medium">Multiple NFTs</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {nftsToList.length} items selected
                    </p>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Price input */}
                <div>
                  <label htmlFor="price" className="block text-sm font-medium mb-1">
                    Price
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
                    Marketplace
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {MARKETPLACES.map((marketplace) => {
                      const isSelected = selectedMarketplaces.includes(marketplace.id);
                      // Find the status for this marketplace
                      const status = marketplaceStatuses.find(s => s.id === marketplace.id);

                      return (
                        <button
                          key={marketplace.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMarketplaces(selectedMarketplaces.filter(m => m !== marketplace.id));
                            } else {
                              setSelectedMarketplaces([...selectedMarketplaces, marketplace.id]);
                            }
                          }}
                          disabled={isSubmitting}
                          className={`flex relative items-center justify-center p-3 rounded-lg ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200'
                              : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                          } ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <div className="relative">
                            <Image
                              src={marketplace.logo}
                              alt={marketplace.name}
                              width={20}
                              height={20}
                              className="h-5 w-auto mr-2"
                              unoptimized
                            />
                          </div>

                          {/* Selection indicator */}
                          {isSelected && !status && (
                            <div className="absolute bottom-0 right-0 bg-blue-500 rounded-br-md rounded-tl-md w-4 h-4 flex items-center justify-center shadow-sm">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}

                          {/* Status indicators */}
                          {status && (
                            <div className={`absolute bottom-0 right-0 rounded-br-md rounded-tl-md w-4 h-4 flex items-center justify-center shadow-sm ${
                              status.status === 'success' ? 'bg-green-500' :
                              status.status === 'failed' ? 'bg-red-500' :
                              status.status === 'pending' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}>
                              {status.status === 'success' && <Check className="h-3 w-3 text-white" />}
                              {status.status === 'failed' && <X className="h-3 w-3 text-white" />}
                              {status.status === 'pending' && <Loader2 className="h-3 w-3 text-white animate-spin" />}
                              {status.status === 'idle' && <Check className="h-3 w-3 text-white" />}
                            </div>
                          )}

                          <span className="font-medium">{marketplace.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Processing steps */}
                {isSubmitting && currentStep && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <div className="flex items-center mb-2">
                      <div className="mr-2">
                        {success ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {currentStep}
                        </p>
                        {processingStep > 0 && totalSteps > 0 && (
                          <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 mt-1 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${(processingStep / totalSteps) * 100}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Marketplace Status Summary */}
                {marketplaceStatuses.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h4 className="text-sm font-medium">Listing Status</h4>

                    {marketplaceStatuses.map((status) => (
                      <div
                        key={status.id}
                        className={`p-3 rounded-md border flex items-center justify-between ${
                          status.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                          status.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
                          status.status === 'pending' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' :
                          'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Image
                            src={status.logo}
                            alt={status.name}
                            width={16}
                            height={16}
                            className="h-4 w-auto"
                            unoptimized
                          />
                          <span className="font-medium text-sm">{status.name}</span>
                        </div>

                        <div className="flex items-center">
                          {status.status === 'success' && (
                            <div className="flex items-center text-green-600 dark:text-green-400">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              <span className="text-xs">Listed successfully</span>
                            </div>
                          )}

                          {status.status === 'failed' && (
                            <div className="flex items-center text-red-600 dark:text-red-400">
                              <XCircle className="h-4 w-4 mr-1" />
                              <span className="text-xs">{status.error || 'Listing failed'}</span>
                            </div>
                          )}

                          {status.status === 'pending' && (
                            <div className="flex items-center text-blue-600 dark:text-blue-400">
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              <span className="text-xs">Processing...</span>
                            </div>
                          )}

                          {status.status === 'idle' && (
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <span className="text-xs">Waiting to start</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Success message */}
                {success && hasAnySuccess && (
                  <div className="mt-6 p-6 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-md text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="flex items-center justify-center space-x-3 text-green-700 dark:text-green-300">
                        <div className="relative">
                          <div className="h-16 w-16 rounded-full bg-green-200 dark:bg-green-800/60 flex items-center justify-center">
                            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400 animate-[pulse_1s_ease-in-out_infinite]" />
                          </div>
                        </div>
                        <span className="text-2xl font-medium">Listing Successful!</span>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                        {marketplaceStatuses.some(s => s.status === 'pending')
                          ? 'Some marketplaces are still processing. You can close this window when ready.'
                          : 'Please close this window when you\'re ready'}
                      </p>
                    </div>
                  </div>
                )}



                {/* Error message */}
                {error && hasAllFailed && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit button - hidden when success is shown */}
                {!success && (
                  <Button
                    type="submit"
                    variant="default"
                    className="w-full text-white bg-blue-500 hover:bg-blue-600 py-3 rounded-lg font-medium"
                    disabled={isSubmitting || selectedMarketplaces.length === 0}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : `List NFT`}
                  </Button>
                )}

                {/* Close button (shown after success) */}
                {success && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2 py-3 rounded-lg font-medium"
                    onClick={handleClose}
                  >
                    Close
                  </Button>
                )}
              </div>
            </form>

            {/* Confirmation Dialog */}
            {showCloseConfirmation && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-10">
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-sm w-full shadow-xl">
                  <h3 className="text-lg font-semibold mb-2">Cancel Listing?</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                    Your listing is in progress. Closing now will cancel the process. Are you sure you want to close?
                  </p>
                  <div className="flex space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowCloseConfirmation(false)}
                    >
                      Continue Listing
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                      onClick={handleConfirmedClose}
                    >
                      Close Anyway
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
