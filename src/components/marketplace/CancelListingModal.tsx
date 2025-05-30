'use client';

import { NFT } from '@/types';
import { useAccount } from 'wagmi';
import { useNFTs } from '@/context/NFTContext';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cancelNFTListings } from '@/services/marketplace/nftgo';
import { Alert, AlertDescription } from '@/components/ui/Alert';

// We'll use a type assertion instead of extending the Window interface
// to avoid TypeScript errors

// Helper function to wait for a transaction to be mined
const waitForTransaction = async (txHash: string, maxAttempts = 10): Promise<void> => {
  if (!window.ethereum) {
    throw new Error('No Ethereum provider found');
  }

  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      // Check transaction receipt
      const receipt = await (window.ethereum as any).request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });

      // If receipt exists and has confirmations, transaction is mined
      if (receipt && receipt.blockNumber) {
        return;
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      console.warn('Error checking transaction receipt:', error);
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
  }

  throw new Error('Transaction confirmation timeout');
};

interface CancelListingModalProps {
  nft: NFT | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CancelListingModal({ nft, isOpen, onClose, onSuccess }: CancelListingModalProps) {
  const { getListingInfo, refreshNFTs, refreshUserListings } = useNFTs();
  const { address } = useAccount();

  // States for the cancellation process
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get the listing information for the NFT
  const listingInfo = nft ? getListingInfo(nft) : null;

  // Format price for display
  const formattedPrice = listingInfo?.price
    ? `${listingInfo.price.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${listingInfo.currency}`
    : '';

  // Handle the cancellation process
  const handleCancelListing = async () => {
    if (!address || !nft || !listingInfo) return;

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Canceling listing with info:', listingInfo);

      // Determine which ID to use (order_id or order_hash)
      const orderId = listingInfo.id;
      const orderHash = listingInfo.orderHash;

      // Log the IDs we're using
      console.log('Using order ID:', orderId);
      console.log('Using order hash:', orderHash);

      // Call the NFTGo API to cancel the listing
      // Pass both IDs if available, the service will handle which one to use
      const response = await cancelNFTListings(address, [orderHash || orderId]);

      console.log('Cancel listing response:', response);

      // Process the response to handle wallet transactions
      if (response && response.code === 'SUCCESS' && response.data && response.data.actions) {
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
              throw new Error(`Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`);
            }
          }

          // Set success state
          setSuccess(true);

          // Force refresh NFTs and listings with a delay to ensure blockchain state is updated
          setTimeout(async () => {
            console.log('Refreshing NFT data after cancellation...');
            try {
              // First, clear any cached data by forcing a refresh of user listings
              // This will also refresh the main NFTs list through the updated refreshUserListings function
              await refreshUserListings();

              // Call onSuccess callback if provided
              if (onSuccess) onSuccess();

              console.log('NFT data refreshed successfully');

              // Close the modal after data is refreshed
              setTimeout(() => {
                onClose();
                // Reset states after closing
                setTimeout(() => {
                  setSuccess(false);
                  setIsSubmitting(false);
                }, 300);
              }, 1000);
            } catch (refreshError) {
              console.error('Error refreshing NFT data:', refreshError);
            }
          }, 3000); // Add a 3-second delay to allow blockchain state to update
        } else {
          console.log('No transaction actions found in the response');

          // Even if no transaction actions, still refresh data
          await refreshUserListings();
          await refreshNFTs();

          // Call onSuccess callback if provided
          if (onSuccess) onSuccess();
        }

        // Modal will be closed after data refresh in the timeout above for transaction actions
        // or immediately for non-transaction actions
        if (!transactionActions.length) {
          setTimeout(() => {
            onClose();
            // Reset states after closing
            setTimeout(() => {
              setSuccess(false);
              setIsSubmitting(false);
            }, 300);
          }, 1500);
        }
      } else {
        throw new Error('Invalid response from NFTGo API');
      }
    } catch (err) {
      console.error('Error canceling listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel listing');
      setIsSubmitting(false);
    }
  };

  // Handle closing the modal
  const handleClose = useCallback(() => {
    if (isSubmitting && !success) return; // Prevent closing during submission
    onClose();
    // Reset states after closing
    setTimeout(() => {
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
    }, 300);
  }, [isSubmitting, onClose, success]);

  // If modal is not open or no NFT is selected, don't render anything
  if (!isOpen || !nft || !listingInfo) {
    return null;
  }

  // Get expiration info if available
  const expirationInfo = listingInfo.expiresAt
    ? `Expires in ${Math.ceil((listingInfo.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`
    : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            className="relative w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold">Cancel Listing</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting && !success}
                className="p-1"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Item details */}
            <div className="mb-6">
              <h4 className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Item</h4>
              <div className="flex items-center p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                {/* NFT Image */}
                <div className="relative h-16 w-16 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-800 mr-3 flex-shrink-0">
                  {nft.image ? (
                    <img
                      src={nft.image}
                      alt={nft.name}
                      className="object-cover h-full w-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full w-full text-zinc-400">
                      <span>No Image</span>
                    </div>
                  )}
                </div>

                {/* NFT Details */}
                <div className="flex-1">
                  <h3 className="font-medium">{nft.name}</h3>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {nft.collection?.name && (
                      <div>ENS: {nft.collection.name}</div>
                    )}
                    <div className="flex items-center">
                      <span className="mr-1">Ethereum</span>
                      {expirationInfo && (
                        <span className="text-xs">{expirationInfo}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right">
                  <div className="font-medium">{formattedPrice}</div>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="text-center mb-6 text-zinc-600 dark:text-zinc-400 text-sm">
              This action will cancel your listing. You will be prompted to confirm this
              cancellation from your wallet. A gas fee is required.
            </div>

            {/* Error message */}
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success message */}
            {success && (
              <Alert variant="success" className="mb-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Listing successfully canceled!</AlertDescription>
              </Alert>
            )}

            {/* Action button */}
            <Button
              variant="default"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center"
              onClick={handleCancelListing}
              disabled={isSubmitting || success}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Canceled
                </>
              ) : (
                'Continue to Cancel'
              )}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}