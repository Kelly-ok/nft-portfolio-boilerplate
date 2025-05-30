'use client';

import { NFT } from '@/types';
import { useAccount } from 'wagmi';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { X, DollarSign, Clock } from 'lucide-react';

interface MagicEdenOfferModalProps {
  nft: NFT | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function MagicEdenOfferModal({ nft, isOpen, onClose, onSuccess }: MagicEdenOfferModalProps) {
  const { address, chain } = useAccount();
  const [price, setPrice] = useState<string>('');
  const [duration, setDuration] = useState<number>(3); // Default 3 days
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrice('');
      setDuration(3);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nft || !address) {
      setError('Missing NFT or wallet connection');
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      setError('Please enter a valid price');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // This is where we would integrate with Magic Eden API
      // For now, we'll just simulate a successful offer

      // Example API call structure (not implemented):
      /*
      const response = await fetch('https://api-mainnet.magiceden.dev/v3/rtp/ethereum/execute/bid/v5', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.MAGIC_EDEN_API_KEY || '',
        },
        body: JSON.stringify({
          maker: address,
          chain: chain?.name.toLowerCase() || 'ethereum',
          tokenAddress: nft.contractAddress,
          tokenId: nft.tokenId,
          price: price,
          expiration: duration * 24 * 60 * 60, // Convert days to seconds
          source: 'nft-portfolio'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create offer');
      }
      */

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Call success callback
      if (onSuccess) onSuccess();

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error creating offer:', err);
      setError(typeof err === 'string' ? err : (err as Error).message || 'Failed to create offer');
    } finally {
      setIsSubmitting(false);
    }
  }, [nft, address, price, duration, chain, onClose, onSuccess]);

  // Duration options
  const durationOptions = [
    { value: 1, label: '1 day' },
    { value: 3, label: '3 days' },
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
  ];

  if (!isOpen || !nft) return null;

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
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Make an Offer</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Set your offer price and duration
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
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
                    alt={nft.name}
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

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Price input */}
                <div>
                  <label htmlFor="price" className="block text-sm font-medium mb-1">
                    Offer Price
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-4 w-4 text-zinc-500" />
                    </div>
                    <input
                      type="number"
                      id="price"
                      placeholder="0.00"
                      step="0.000001"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-sm text-zinc-500">
                        {chain?.nativeCurrency.symbol || 'ETH'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Duration selection */}
                <div>
                  <label htmlFor="duration" className="block text-sm font-medium mb-1">
                    Offer Duration
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Clock className="h-4 w-4 text-zinc-500" />
                    </div>
                    <select
                      id="duration"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="pl-10 pr-4 py-2 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {durationOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Marketplace fees info */}
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-md p-3">
                  <h5 className="text-sm font-medium mb-2">Offer Information</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Magic Eden Fee</span>
                      <span>2%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Creator Royalty</span>
                      <span>Up to 5%</span>
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <span className="text-zinc-500">You&apos;ll pay now</span>
                      <span className="font-medium">{price || '0'} {chain?.nativeCurrency.symbol || 'ETH'}</span>
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating Offer...' : 'Make Offer'}
                </Button>
              </div>
            </form>

            {/* Magic Eden branding */}
            <div className="mt-4 flex justify-center items-center">
              <span className="text-xs text-zinc-500 mr-1">Powered by</span>
              <img
                src="https://magiceden.io/img/logo.png"
                alt="Magic Eden"
                className="h-4"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
