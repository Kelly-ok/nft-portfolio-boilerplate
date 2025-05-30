import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/Button';
import { NFT, MarketplaceListing } from '@/types';
import { cancelNFTListings } from '@/services/marketplace/nftgo';
import BulkListingModal from './BulkListingModal';

interface ListingActionsProps {
  nft: NFT;
  listings: MarketplaceListing[];
  onSuccess?: () => void;
  onError?: (error: string) => void;
  refreshListings: () => Promise<void>;
  selectionMode?: boolean; // Add selection mode prop
}

export function ListingActions({
  nft,
  listings,
  onSuccess,
  onError,
  refreshListings,
  selectionMode = false
}: ListingActionsProps) {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Check if the connected wallet is the owner of the NFT
  const isOwner = address && nft.owner && address.toLowerCase() === nft.owner.toLowerCase();

  // Only show actions if the connected wallet is the owner
  if (!isOwner) return null;

  const handleCancel = async () => {
    if (!address) return;

    setIsLoading(true);

    try {
      // Get the order IDs to cancel
      const orderIds = listings.map(listing => listing.id);

      if (orderIds.length === 0) {
        throw new Error('No listings found to cancel');
      }

      // Call the cancelNFTListings function
      const result = await cancelNFTListings(address, orderIds);

      console.log('Cancel listings result:', result);

      // Refresh the listings
      await refreshListings();

      // Call the onSuccess callback
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error canceling listings:', error);

      // Call the onError callback
      if (onError) onError(error instanceof Error ? error.message : 'Failed to cancel listings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = async () => {
    // Refresh the listings
    await refreshListings();

    // Call the onSuccess callback
    if (onSuccess) onSuccess();
  };

  // If there are no listings, don't render anything
  if (listings.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col space-y-2 mt-4">
      <Button
        variant="outline"
        onClick={handleCancel}
        disabled={isLoading || selectionMode}
        className={`w-full ${selectionMode ? 'opacity-50 cursor-not-allowed' : ''}`}
        iconClass="w-6 h-6 mr-2"
      >
        {isLoading ? 'Canceling...' : 'Cancel Listing'}
      </Button>

      <Button
        variant="default"
        onClick={handleEdit}
        disabled={isLoading || selectionMode}
        className={`w-full ${selectionMode ? 'opacity-50 cursor-not-allowed' : ''}`}
        iconClass="w-6 h-6 mr-2"
      >
        Edit Price
      </Button>

      {/* Edit Modal */}
      <BulkListingModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
