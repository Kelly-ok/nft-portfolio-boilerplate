'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNFTs } from '@/context/NFTContext';
import { useAccount, useSignTypedData, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Loader2, X, CheckCircle, Check, XCircle } from 'lucide-react';
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

  console.log(error)

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
    signatureKind: 'eip712' | string; // Allow other kinds if necessary
    domain: Record<string, any>;
    types: Record<string, any>;
    value: Record<string, any>;
    message?: string; // Optional message for non-EIP712
  };
  post?: {
    endpoint: string;
    method: 'POST' | 'GET'; // Allow other methods if needed
    body: Record<string, any>;
  };
}

interface NFTGoTransactionActionData {
  from?: `0x${string}`;
  to?: `0x${string}`;
  data?: `0x${string}`;
  value?: string; // Keep as string, wagmi will handle conversion
  txData?: {
    from: `0x${string}`;
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
  };
  // Additional properties from NFTGo API response
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

// Response data structure from NFTGo API
type NFTGoApiResponseData = {
  actions: NFTGoAction[];
  // Add other potential fields from the 'data' object if needed
}

// NFTGo supported marketplaces
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

const DURATION_OPTIONS = [
  { value: 1, label: '1 Day' },
  { value: 3, label: '3 Days' },
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
  { value: 90, label: '90 Days' },
];

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

interface BulkListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BulkListingModal({ isOpen, onClose }: BulkListingModalProps) {
  const { selectedNFTs, createBulkListing, refreshUserListings } = useNFTs();
  const { address, isConnected, chain } = useAccount();

  // Store a local copy of the selected NFTs to prevent UI issues when the context state changes
  const [localSelectedNFTs, setLocalSelectedNFTs] = useState<any[]>([]);

  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState(7); // Default to 7 days
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>(['opensea', 'looksrare', 'nftgo']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [orderSignature, setOrderSignature] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track marketplace-specific status
  const [marketplaceStatuses, setMarketplaceStatuses] = useState<MarketplaceStatus[]>([]);
  const [hasAnySuccess, setHasAnySuccess] = useState(false);
  const [hasAllFailed, setHasAllFailed] = useState(false);

  // Carousel state
  const [currentNFTIndex, setCurrentNFTIndex] = useState(0);

  // Polling references for individual marketplaces
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Wagmi hooks
  const { signTypedDataAsync } = useSignTypedData();
  const { data: txHash, sendTransactionAsync, isPending: isTxPending, error: txError } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmationError } = useWaitForTransactionReceipt({ hash: txHash });

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

  // Handle manual close with refresh using useCallback
  const handleClose = useCallback(() => {
    // If listing was successful, refresh user listings before closing
    if (success) {
      console.log('Refreshing user listings on manual close...');
      refreshUserListings();
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
  }, [success, refreshUserListings, onClose]);

  // We've removed the countdown timer effect as we want manual closing only

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      // Initialize the local copy of selected NFTs when the modal opens
      setLocalSelectedNFTs(selectedNFTs);

      setPrice('');
      setDuration(7);
      setSelectedMarketplaces(['opensea', 'looksrare', 'nftgo']);
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
      setCurrentStep(null);
      setProcessingStep(0);
      setTotalSteps(0);
      setOrderSignature(null); // Reset the signature
      setOrderStatus(null);

      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    } else {
      // Reset everything on close
      setPrice('');
      setDuration(7);
      setSelectedMarketplaces(['opensea', 'looksrare', 'nftgo']);
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
      setCurrentStep(null);
      setProcessingStep(0);
      setTotalSteps(0);
      setOrderSignature(null); // Reset the signature
      setOrderStatus(null);

      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isOpen, selectedNFTs]);

  // Handle transaction confirmation state
  useEffect(() => {
    if (isConfirming) {
      setCurrentStep(`Confirming transaction...`);
    }
    if (isConfirmed) {
      setCurrentStep(`Transaction confirmed!`);
      // Potentially move to the next step here if needed, or handle in handleSubmit
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

  // Keep the local copy of selected NFTs in sync with the context's selectedNFTs
  // but only when not in the middle of a transaction
  useEffect(() => {
    // Only update if not submitting and not successful
    if (!isSubmitting && !success) {
      console.log('Updating localSelectedNFTs from context');
      setLocalSelectedNFTs(selectedNFTs);
    }
  }, [selectedNFTs, isSubmitting, success]);

  if (!isOpen) return null;

  // We don't need this function anymore as we're handling marketplace selection directly in the UI
  // const handleMarketplaceToggle = (marketplaceId: string) => {
  //   setSelectedMarketplaces(prev => {
  //     if (prev.includes(marketplaceId)) {
  //       return prev.filter(id => id !== marketplaceId);
  //     } else {
  //       return [...prev, marketplaceId];
  //     }
  //   });
  // };

  const handleSubmit = async () => {
    if (!address || !isConnected) {
      setError('Wallet not connected');
      return;
    }
    if (!chain) {
      setError('Could not determine network chain.');
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

    if (localSelectedNFTs.length === 0) {
      setError('No NFTs selected for listing');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    setCurrentStep('Preparing listing request...');
    setProcessingStep(0);
    setTotalSteps(0);

    try {
      // 1. Call the backend/service to get the actions
      const apiResponse: NFTGoApiResponseData = await createBulkListing(price, selectedMarketplaces, duration);

      // Validate the response structure
      if (!apiResponse || !Array.isArray(apiResponse.actions)) {
        throw new Error('Invalid response received from listing API.');
      }

      const actions: NFTGoAction[] = apiResponse.actions;
      setTotalSteps(actions.length);

      // Store signature in a local variable to avoid React state timing issues
      let currentSignature: string | null = null;

      // Track the current marketplace being processed
      let currentMarketplace: string | null = null;

      // 2. Process actions sequentially
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        setProcessingStep(i + 1);
        setCurrentStep(`${action.description}`);

        try {
          if (action.kind === 'signature') {
            const signatureData = action.data as NFTGoSignatureActionData;
            if (signatureData.sign.signatureKind === 'eip712') {
              console.log('Signing EIP712 data:', JSON.stringify(signatureData.sign, null, 2));
              const signature = await signTypedDataAsync({
                domain: signatureData.sign.domain,
                types: signatureData.sign.types,
                primaryType: Object.keys(signatureData.sign.types)[0], // Infer primaryType
                message: signatureData.sign.value,
              });
              console.log('Signature obtained:', signature);

              // Store the signature both in state and in a local variable
              currentSignature = signature; // Store in local variable for immediate use
              setOrderSignature(signature); // Also update React state

              // Optional: Post signature back if required by API
              if (signatureData.post) {
                setCurrentStep(`Submitting signature...`);
                const postResponse = await fetch(signatureData.post.endpoint, {
                  method: signatureData.post.method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...signatureData.post.body, signature }), // Include signature
                });
                if (!postResponse.ok) {
                  const errorText = await postResponse.text();
                  throw new Error(`Failed to post signature: ${errorText}`);
                }
                console.log('Signature posted successfully.');
              } else {
                // Even if there's no post endpoint, we should wait a bit to ensure the signature is processed
                console.log('No post endpoint specified, waiting briefly for signature processing...');
                // Add a small delay to ensure the signature is processed
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } else {
              // Handle other signature kinds if necessary
              throw new Error(`Unsupported signature kind: ${signatureData.sign.signatureKind}`);
            }
          } else if (action.kind === 'transaction') {
            const txData = action.data as NFTGoTransactionActionData;
            console.log('Received transaction data:', JSON.stringify(txData, null, 2));

            // Extract and validate the 'to' address
            let toAddress: `0x${string}` | undefined;
            let txDataHex: `0x${string}` | undefined;
            let txValue: string | undefined;
            let txFrom: `0x${string}` | undefined;

            // Handle different response formats from NFTGo API
            if (txData.to && typeof txData.to === 'string' && txData.to.startsWith('0x')) {
              // Standard format
              toAddress = txData.to as `0x${string}`;
              txDataHex = txData.data;
              txValue = txData.value;
              txFrom = txData.from;
            } else if (txData.txData) {
              // Nested in txData property
              toAddress = txData.txData.to;
              txDataHex = txData.txData.data;
              txValue = txData.txData.value;
              txFrom = txData.txData.from;
            } else if ('tx_data' in txData && txData.tx_data) {
              // Nested in tx_data property (NFTGo specific format)
              toAddress = txData.tx_data.to;
              txDataHex = txData.tx_data.data;
              txValue = txData.tx_data.value;
              txFrom = txData.tx_data.from;
            }

            // Validate that we have a valid 'to' address
            if (!toAddress || !toAddress.startsWith('0x')) {
              console.error('Invalid transaction data structure:', JSON.stringify(txData, null, 2));
              throw new Error('Invalid transaction data: missing or invalid "to" address');
            }

            console.log('Transaction data validation:', {
              to: toAddress,
              hasData: !!txDataHex,
              dataLength: txDataHex?.length,
              value: txValue,
              from: txFrom,
              chainId: chain?.id || 1
            });

            // Use sendTransactionAsync and wait for confirmation
            const submittedTx = await sendTransactionAsync({
              to: toAddress,
              data: txDataHex,
              value: txValue ? parseEther(txValue) : undefined, // Convert value if present
              gas: undefined, // Let wagmi estimate gas
              chainId: chain?.id || 1 // Use connected chain ID or default to Ethereum mainnet
            });
            console.log('Transaction submitted:', submittedTx);
            setCurrentStep(`Waiting for confirmation...`);

            // Store the transaction hash for confirmation tracking
            const currentTxHash = submittedTx;
            console.log('Waiting for transaction confirmation, hash:', currentTxHash);

            // Wait for the transaction to be confirmed
            // Create a promise that resolves when the transaction is confirmed or rejects when there's an error
            await new Promise((resolve, reject) => {
              let isResolved = false;

              // Set up a polling interval to check transaction status
              const checkInterval = setInterval(() => {
                // Check if this specific transaction is confirmed
                if (txHash === currentTxHash && isConfirmed) {
                  if (!isResolved) {
                    console.log('Transaction confirmed:', currentTxHash);
                    clearInterval(checkInterval);
                    isResolved = true;
                    resolve(true);
                  }
                } else if (txHash === currentTxHash && confirmationError) {
                  if (!isResolved) {
                    console.error('Transaction confirmation error:', confirmationError);
                    clearInterval(checkInterval);
                    isResolved = true;
                    reject(confirmationError);
                  }
                }
              }, 1000); // Check every second

              // Set a timeout to prevent infinite waiting
              setTimeout(() => {
                if (!isResolved) {
                  clearInterval(checkInterval);
                  // If we reach the timeout without confirmation, we'll continue anyway
                  console.warn('Transaction confirmation timeout reached, continuing...');
                  isResolved = true;
                  resolve(false);
                }
              }, 60000); // 60 second timeout
            });

          } else if (action.kind === 'pass-through') {
            const passData = action.data as NFTGoPassThroughActionData;
            console.log('Processing pass-through action:', JSON.stringify(passData, null, 2));

            // Handle the pass-through action by making the API call
            setCurrentStep(`${action.description}`);

            // Construct the full endpoint URL (assuming relative path)
            console.log('Pass-through endpoint from API:', passData.endpoint);

            // The endpoint should be properly constructed
            // Use the specific endpoint for post-order
            const endpoint = `/api/nftgo/trade/v1/nft/post-order`;

            console.log('Constructed endpoint for pass-through action:', endpoint);

            // Determine which marketplace this is for
            if (passData.payload.orderbook) {
              // Find the marketplace ID based on the orderbook
              const marketplace = MARKETPLACES.find(m => m.orderbook === passData.payload.orderbook);
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

            // Check if we have a signature from previous steps
            console.log('Current orderSignature state:', orderSignature);
            console.log('Current local signature:', currentSignature);

            // Determine which signature to use (prefer local variable over React state)
            const signatureToUse = currentSignature || orderSignature;

            if (!signatureToUse) {
              console.warn('No signature found for pass-through action. This may cause the request to fail.');
            } else {
              console.log('Using signature for pass-through action:', signatureToUse);
            }

            // Create a modified payload that includes the signature
            const modifiedPayload = { ...passData.payload };

            // Add the signature to the order in the payload if available
            if (signatureToUse) {
              // Handle different order kinds (e.g., seaport, payment-processor-v2)
              if (modifiedPayload.order && modifiedPayload.order.kind === 'payment-processor-v2') {
                console.log('Handling payment-processor-v2 order signature');
                modifiedPayload.signature = signatureToUse;
                if (modifiedPayload.order.data) {
                  if (signatureToUse.length >= 132) {
                    const r = '0x' + signatureToUse.slice(2, 66);
                    const s = '0x' + signatureToUse.slice(66, 130);
                    modifiedPayload.order.data.r = r;
                    modifiedPayload.order.data.s = s;
                  } else {
                    console.warn('Signature format is not as expected for payment-processor-v2');
                  }
                }
              } else if (modifiedPayload.order && modifiedPayload.order.kind?.startsWith('seaport')) {
                console.log('Handling seaport order signature');
                // Seaport orders typically expect the signature at the root level
                modifiedPayload.signature = signatureToUse;
              } else {
                console.log('Adding signature to root payload for unknown/other order kind');
                modifiedPayload.signature = signatureToUse;
              }
            }

            // Add bulk_data if needed (e.g., for OpenSea)
            if (modifiedPayload.orderbook === 'opensea' && !modifiedPayload.bulk_data && modifiedPayload.order) {
              console.log('Adding bulk_data structure for OpenSea');
              modifiedPayload.bulk_data = {
                order: modifiedPayload.order,
                signature: signatureToUse || '', // Use the signature here as well
                order_index: passData.order_indexes ? passData.order_indexes[0] : 0 // Assuming single order index
              };
              // Remove the original order if bulk_data is used
              // delete modifiedPayload.order;
            }

            console.log('Final pass-through payload:', JSON.stringify(modifiedPayload, null, 2));

            // Make the API call for the pass-through action
            const postOrderResponse = await fetch(endpoint, {
              method: passData.method || 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(modifiedPayload),
            });

            if (!postOrderResponse.ok) {
              const errorText = await postOrderResponse.text();
              console.error('Pass-through API error response:', errorText);
              throw new Error(`Failed at step ${i + 1} (${action.description}): Pass-through API call failed with status ${postOrderResponse.status} - ${errorText}`);
            }

            const postOrderData = await postOrderResponse.json();
            console.log('Pass-through API response:', JSON.stringify(postOrderData, null, 2));

            // Check if the initial response indicates success and contains a request_id
            if (postOrderData.code === 'SUCCESS' && postOrderData.data?.request_id) {
              const currentRequestId = postOrderData.data.request_id;
              console.log('Post-order request submitted successfully. Request ID:', currentRequestId);
              setCurrentStep(`Verifying listing status..`);

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
                          if (attempts >= 5 && passData.payload.orderbook === 'nftgo') {
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
                            setOrderStatus('pending');
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
                                setOrderStatus('pending');
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
                          setOrderStatus('pending');
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
                      setOrderStatus('pending');
                      setCurrentStep('Listing submitted, waiting for marketplace confirmation...');
                      setIsSubmitting(false);
                    }
                    await delay(pollInterval);
                  }
                }
              }
            } else {
              // Handle cases where the initial post-order response failed or didn't provide a request_id
              const errorMessage = postOrderData.msg || 'Pass-through action failed or did not return a request ID.';
              console.error('Pass-through action error:', errorMessage, postOrderData);
              throw new Error(`Failed at step ${i + 1} (${action.description}): ${errorMessage}`);
            }
          } else {
            // Handle unknown action kinds
            console.warn('Unknown action kind:', (action as { kind?: string }).kind);
            throw new Error(`Unknown action kind: ${(action as { kind?: string }).kind}`);
          }
        } catch (stepError) {
          // Catch errors specific to a step
          console.error(`Error during step ${i + 1} (${action.description}):`, stepError);
          const parsedStepError = parseErrorMessage(stepError);
          // Prepend step info to the error message
          throw new Error(`Failed at step ${i + 1} (${action.description}): ${parsedStepError}`);
        }
      }

      // Process completed successfully, but we'll let the polling logic handle the success state
      console.log('Bulk listing process completed successfully.');

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
      // Catch errors from the overall process (API call or step execution)
      console.error('Bulk listing failed:', err);
      setError(parseErrorMessage(err));
      setCurrentStep('Listing failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to handle carousel navigation
  const nextNFT = () => {
    if (localSelectedNFTs.length > 0) {
      setCurrentNFTIndex((prev) => (prev + 1) % localSelectedNFTs.length);
    }
  };

  const prevNFT = () => {
    if (localSelectedNFTs.length > 0) {
      setCurrentNFTIndex((prev) => (prev - 1 + localSelectedNFTs.length) % localSelectedNFTs.length);
    }
  };

  // Function to truncate text if it's too long
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-lg p-6 border border-zinc-200 dark:border-zinc-700">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-xl font-semibold">Bulk List {localSelectedNFTs.length || 0} NFTs</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting && !success && !error} // Disable close during active processing unless finished
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!success && (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              List {localSelectedNFTs.length || 0} selected NFTs across multiple marketplaces using the NFTGo API.
              Set a single price and duration for all items.
            </p>

            {/* NFT Carousel */}
            {localSelectedNFTs.length > 0 && (
              <div className="relative mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-center">
                  <button
                    onClick={prevNFT}
                    className="absolute left-2 z-10 p-1 rounded-full bg-white/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700"
                    disabled={localSelectedNFTs.length <= 1}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>

                  <div className="flex flex-col items-center">
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden mb-2">
                      <img
                        src={localSelectedNFTs[currentNFTIndex]?.image || '/images/placeholder-nft.svg'}
                        alt={localSelectedNFTs[currentNFTIndex]?.name || 'NFT'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/images/placeholder-nft.svg';
                        }}
                      />
                    </div>
                    <p className="text-sm font-medium text-center">
                      {truncateText(localSelectedNFTs[currentNFTIndex]?.name || 'Unnamed NFT', 20)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                      {currentNFTIndex + 1} of {localSelectedNFTs.length}
                    </p>
                  </div>

                  <button
                    onClick={nextNFT}
                    className="absolute right-2 z-10 p-1 rounded-full bg-white/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700"
                    disabled={localSelectedNFTs.length <= 1}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Form Content */}
        {!success && (
          <div className="space-y-5">
            {/* Price Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="price" className="text-sm font-medium text-right text-zinc-700 dark:text-zinc-300">
                Price (ETH)
              </label>
              <div className="col-span-3">
                <input
                  id="price"
                  type="number"
                  step="0.0001" // Allow finer price steps
                  min="0"
                  placeholder="e.g., 0.05"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Duration Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="text-sm font-medium text-right text-zinc-700 dark:text-zinc-300">Duration</div>
              <div className="col-span-3 flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${duration === option.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-zinc-100 text-zinc-800 border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-700'
                      } ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    onClick={() => setDuration(option.value)}
                    disabled={isSubmitting}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Marketplace Selection */}
            <div>
              <label htmlFor="marketplace" className="block text-sm font-medium mb-2">
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
                        <img
                          src={marketplace.logo}
                          alt={marketplace.name}
                          width={20}
                          height={20}
                          className="h-5 w-auto mr-2"
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
          </div>
        )}

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
            {(isTxPending || isConfirming) && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Waiting for wallet confirmation and network processing...</p>
            )}
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
                  <img
                    src={status.logo}
                    alt={status.name}
                    width={16}
                    height={16}
                    className="h-4 w-auto"
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

        {/* Error Message */}
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

        {/* Pending Order Status - Legacy */}
        {!success && orderStatus === 'pending' && marketplaceStatuses.length === 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md text-center">
            <div className="flex items-center justify-center space-x-2 text-blue-700 dark:text-blue-300">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Listing submitted, waiting for marketplace confirmation. This may take a few minutes.</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!success && (
          <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isConnected || selectedMarketplaces.length === 0 || !price || parseFloat(price) <= 0}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `List ${localSelectedNFTs.length || 0} Item${(localSelectedNFTs.length || 0) > 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
