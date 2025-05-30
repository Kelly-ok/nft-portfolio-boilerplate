'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { RefreshCw } from 'lucide-react';
import { useNFTs } from '@/context/NFTContext';

interface RefreshListingsButtonProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'bordered' | 'light' | 'flat' | 'faded' | 'shadow' | 'ghost';
  className?: string;
  showText?: boolean;
}

export default function RefreshListingsButton({
  size = 'md',
  variant = 'bordered',
  className = '',
  showText = true
}: RefreshListingsButtonProps) {
  const { forceRefreshListings, clearListingsCache } = useNFTs();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      console.log('User clicked refresh listings button');
      
      // Clear cache first to ensure fresh data
      clearListingsCache();
      
      // Force refresh listings
      await forceRefreshListings();
      
      console.log('Listings refresh completed');
    } catch (error) {
      console.error('Error refreshing listings:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onPress={handleRefresh}
      isLoading={isRefreshing}
      startContent={!isRefreshing ? <RefreshCw size={16} /> : undefined}
    >
      {showText && (isRefreshing ? 'Refreshing...' : 'Refresh Listings')}
    </Button>
  );
}
