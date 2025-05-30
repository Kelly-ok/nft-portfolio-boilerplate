'use client';

import { NFT } from '@/types';
import { useAccount } from 'wagmi';
import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useNFTs } from '@/context/NFTContext';
import * as NFTGo from '@/services/marketplace/nftgo';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface NFTGoAcceptBidModalProps {
  nft: NFT | null;
  bidId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sourceInfo?: {
    name: string;
    icon: string;
    url: string;
  };
}

// Transaction status types
type TransactionStatus = 'idle' | 'preparing' | 'waitingForApproval' | 'processing' | 'success' | 'error';

export default function NFTGoAcceptBidModal({
  nft,
  bidId,
  isOpen,
  onClose,
  onSuccess
}: NFTGoAcceptBidModalProps) {
  const { refreshNFTs } = useNFTs();
  const { address } = useAccount();
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<any[]>([]);

  const [requestIds, setRequestIds] = useState<string[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setError(null);
      setActions([]);

      setRequestIds([]);
    }
  }, [isOpen]);

  // Handle accepting the bid
  const handleAcceptBid = useCallback(async () => {
    if (!nft || !bidId || !address) {
      setError('Missing required information to accept offer');
      return;
    }

    try {
      setStatus('preparing');
      setError(null);

      // Call the NFTGo API to fulfill the offer
      const result = await NFTGo.fulfillOffers(address, [bidId]);

      if (!result || !result.actions || result.actions.length === 0) {
        throw new Error('No actions received from NFTGo API');
      }

      // Store the actions and request IDs
      setActions(result.actions);
      if (result.request_id) {
        setRequestIds([result.request_id]);
      }

      // Process the first action
      setStatus('waitingForApproval');
      await processAction(result.actions[0], 0);

    } catch (error) {
      console.error('Error accepting bid:', error);
      setStatus('error');
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }, [nft, bidId, address]);

  // Process an action from the NFTGo API
  const processAction = useCallback(async (action: any, index: number) => {
    try {

      if (action.kind === 'transaction') {
        // Handle transaction action
        const { to, data, value } = action.data;

        // Request transaction from wallet
        const provider = window.ethereum;
        if (!provider) {
          throw new Error('No Ethereum provider found');
        }

        setStatus('waitingForApproval');
        
        // Send the transaction
        const txHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: address,
            to,
            data,
            value: value || '0x0'
          }]
        });

        console.log('Transaction sent:', txHash);
        setStatus('processing');

        // Wait for transaction confirmation
        // This is simplified - in a real app, you'd want to poll for the transaction receipt
        await new Promise(resolve => setTimeout(resolve, 2000));

      } else if (action.kind === 'signature') {
        // Handle signature action
        const { message } = action.data;
        
        setStatus('waitingForApproval');
        
        // Request signature from wallet
        const provider = window.ethereum;
        if (!provider) {
          throw new Error('No Ethereum provider found');
        }

        const signature = await provider.request({
          method: 'personal_sign',
          params: [message, address]
        });

        console.log('Signature obtained:', signature);
      }

      // Move to the next action if available
      if (index < actions.length - 1) {
        await processAction(actions[index + 1], index + 1);
      } else {
        // All actions completed successfully
        setStatus('success');
        
        // Check post-order results if we have request IDs
        if (requestIds.length > 0) {
          await checkPostOrderResults();
        }
        
        // Call onSuccess callback
        if (onSuccess) {
          onSuccess();
        }
        
        // Refresh NFTs to update the UI
        refreshNFTs();
      }
    } catch (error) {
      console.error('Error processing action:', error);
      setStatus('error');
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }, [actions, address, onSuccess, refreshNFTs, requestIds]);

  // Check post-order results
  const checkPostOrderResults = useCallback(async () => {
    if (requestIds.length === 0) return;

    try {
      const result = await NFTGo.checkPostOrderResults(requestIds);
      console.log('Post-order results:', result);
    } catch (error) {
      console.error('Error checking post-order results:', error);
      // Don't set error state here as the main transaction might have succeeded
    }
  }, [requestIds]);

  // Render the appropriate content based on the current status
  const renderContent = () => {
    switch (status) {
      case 'idle':
        return (
          <>
            <DialogDescription className="text-center mb-6">
              You are about to accept an offer for your NFT. This will transfer the NFT to the buyer and you will receive the payment.
            </DialogDescription>
            <div className="flex justify-center">
              <Button 
                variant="gradient" 
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-8 py-2"
                onClick={handleAcceptBid}
              >
                Accept Offer
              </Button>
            </div>
          </>
        );
      
      case 'preparing':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
            <p className="text-lg font-medium">Preparing transaction...</p>
          </div>
        );
      
      case 'waitingForApproval':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
            <p className="text-lg font-medium">Waiting for wallet approval...</p>
            <p className="text-sm text-zinc-500 mt-2">Please check your wallet and confirm the transaction</p>
          </div>
        );
      
      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
            <p className="text-lg font-medium">Processing transaction...</p>
            <p className="text-sm text-zinc-500 mt-2">This may take a few moments</p>
          </div>
        );
      
      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium text-green-600">Offer accepted successfully!</p>
            <p className="text-sm text-zinc-500 mt-2">The NFT has been transferred and you will receive the payment</p>
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        );
      
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-lg font-medium text-red-600">Error accepting offer</p>
            {error && <p className="text-sm text-zinc-500 mt-2">{error}</p>}
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  // If modal is not open or no NFT is selected, don't render anything
  if (!isOpen || !nft || !bidId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Accept Offer</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
