'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { NFT } from '@/types';
import { Button } from '@/components/ui/Button';
import { X, Check } from 'lucide-react';
import { Key } from 'react';
import { formatDateValue, getUniqueAttributes } from '@/utils/formatters';

interface TraitsModalProps {
    nft: NFT;
    isOpen: boolean;
    onClose: () => void;
}

export default function TraitsModal({ nft, isOpen, onClose }: TraitsModalProps) {

    // Debug traits data when modal opens
    if (isOpen) {
        console.log('TraitsModal opened for NFT:', nft.name, nft.id);
        console.log('NFT direct attributes:', nft.attributes);
        console.log('NFT metadata:', nft.metadata);

        // Check for traits in different locations
        const hasDirect = nft.attributes && nft.attributes.length > 0;
        const hasNormalizedMetadata = nft.metadata &&
                                    typeof nft.metadata === 'object' &&
                                    nft.metadata.normalized_metadata?.attributes &&
                                    nft.metadata.normalized_metadata.attributes.length > 0;
        const hasMetadataAttributes = nft.metadata &&
                                    typeof nft.metadata === 'object' &&
                                    nft.metadata.attributes &&
                                    Array.isArray(nft.metadata.attributes) &&
                                    nft.metadata.attributes.length > 0;

        console.log('Modal - Has direct attributes:', hasDirect);
        console.log('Modal - Has normalized metadata attributes:', hasNormalizedMetadata);
        console.log('Modal - Has metadata attributes:', hasMetadataAttributes);

        if (hasDirect) {
            console.log('Direct attributes content:', JSON.stringify(nft.attributes, null, 2));
        }

        if (hasNormalizedMetadata && nft.metadata && typeof nft.metadata === 'object' && nft.metadata.normalized_metadata) {
            console.log('Normalized metadata attributes content:',
                JSON.stringify(nft.metadata.normalized_metadata.attributes, null, 2));
        }

        if (hasMetadataAttributes && nft.metadata && typeof nft.metadata === 'object' && nft.metadata.attributes) {
            console.log('Metadata attributes content:',
                JSON.stringify(nft.metadata.attributes, null, 2));
        }
    }

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
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-semibold">{nft.name} Traits</h3>
                                {nft.collection && (
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        {nft.collection.name}
                                    </p>
                                )}
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

                        {/* Display deduplicated traits */}
                        {(nft) ? (
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {/* Get unique attributes using our utility function */}
                                    {(() => {
                                        const uniqueAttributes = getUniqueAttributes(nft);

                                        if (uniqueAttributes.length === 0) {
                                            return (
                                                <p className="text-zinc-500 dark:text-zinc-400 text-center py-8 col-span-2">
                                                    No traits available for this NFT
                                                </p>
                                            );
                                        }

                                        return uniqueAttributes.map((trait: {
                                            percentage?: number;
                                            trait_type: string;
                                            value: string | number | boolean;
                                            display_type?: string | null;
                                        }, i: Key) => {
                                            let bgColor = 'bg-zinc-100';
                                            let darkBgColor = 'bg-zinc-800';

                                            // Apply color coding based on rarity if available
                                            if (typeof trait.percentage === 'number') {
                                                if (trait.percentage < 1) {
                                                    bgColor = 'bg-red-900 text-white';
                                                    darkBgColor = 'bg-red-950 text-white';
                                                } else if (trait.percentage < 5) {
                                                    bgColor = 'bg-red-700 text-white';
                                                    darkBgColor = 'bg-red-800 text-white';
                                                } else if (trait.percentage < 15) {
                                                    bgColor = 'bg-red-500 text-white';
                                                    darkBgColor = 'bg-red-600 text-white';
                                                } else if (trait.percentage < 30) {
                                                    bgColor = 'bg-orange-400 text-white';
                                                    darkBgColor = 'bg-orange-500 text-white';
                                                } else if (trait.percentage < 50) {
                                                    bgColor = 'bg-yellow-300 text-zinc-800';
                                                    darkBgColor = 'bg-yellow-400 text-zinc-800';
                                                } else if (trait.percentage < 75) {
                                                    bgColor = 'bg-green-200 text-zinc-800';
                                                    darkBgColor = 'bg-green-300 text-zinc-800';
                                                } else {
                                                    bgColor = 'bg-blue-100 text-zinc-800';
                                                    darkBgColor = 'bg-blue-200 text-zinc-800';
                                                }
                                            }

                                            return (
                                                <div
                                                    key={`trait-${i}`}
                                                    className={`rounded-lg p-3 ${bgColor} dark:${darkBgColor}`}
                                                >
                                                    <p className="text-sm font-medium">{trait.trait_type}</p>
                                                    {(typeof trait.value === 'boolean' || trait.value === 'true' || trait.value === 'false') ? (
                                                        <div className="flex items-center">
                                                            {trait.value === true || trait.value === 'true' ? (
                                                                <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
                                                            ) : (
                                                                <X className="h-4 w-4 text-red-500 dark:text-red-400" />
                                                            )}
                                                        </div>
                                                    ) : trait.display_type === 'date' || (trait.trait_type.toLowerCase().includes('date') && !isNaN(Number(trait.value))) ? (
                                                        <p className="text-sm">
                                                            {(() => {
                                                                const { time, date } = formatDateValue(trait.value);
                                                                return `${time} | ${date}`;
                                                            })()}
                                                        </p>
                                                    ) : (
                                                        <p className="text-sm">{trait.value}</p>
                                                    )}

                                                    {/* Show rarity percentage if available */}
                                                    {trait.percentage !== undefined && (
                                                        <div className="text-xs mt-1 opacity-80">
                                                            Rarity: {trait.percentage.toFixed(2)}%
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        ) : (
                            // No NFT available
                            <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
                                No traits available for this NFT
                            </p>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}