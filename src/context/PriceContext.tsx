'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PriceContextType {
  ethPrice: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const PriceContext = createContext<PriceContextType>({
  ethPrice: 0,
  isLoading: true,
  error: null,
  lastUpdated: null
});

export const usePrice = () => useContext(PriceContext);

export const PriceProvider = ({ children }: { children: ReactNode }) => {
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch ETH price from DIA API
        const response = await fetch('https://api.diadata.org/v1/assetQuotation/Ethereum/0x0000000000000000000000000000000000000000');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ETH price: ${response.status}`);
        }

        const data = await response.json();
        
        if (data && data.Price) {
          console.log('Fetched ETH price:', data.Price);
          setEthPrice(data.Price);
          setLastUpdated(new Date());
        } else {
          throw new Error('Invalid price data received');
        }
      } catch (err) {
        console.error('Error fetching ETH price:', err);
        setError(err instanceof Error ? err.message : 'Unknown error fetching ETH price');
        
        // Fallback to a default price if the API fails
        setEthPrice(2500);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch price on initial load
    fetchEthPrice();

    // Don't set up an interval for refreshing the price
    // We only need to fetch it once per page load as requested
  }, []);

  return (
    <PriceContext.Provider
      value={{
        ethPrice,
        isLoading,
        error,
        lastUpdated
      }}
    >
      {children}
    </PriceContext.Provider>
  );
};
