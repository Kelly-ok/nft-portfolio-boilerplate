'use client';

import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { NFTProvider } from '@/context/NFTContext';
import { PriceProvider } from '@/context/PriceContext';

import { configureEventEmitter } from '@/lib/walletConnectConfig';
import { HeroUIProvider } from "@heroui/react";

// Create a client for React Query
const queryClient = new QueryClient();

// Configure EventEmitter to prevent MaxListenersExceededWarning
configureEventEmitter();


// Configure Wagmi and RainbowKit together
const config = getDefaultConfig({
    appName: 'NFT Dashboard',
    projectId: '1f8671827cd13339d7bc8a6dd895dfb7', // Replace with your WalletConnect project ID
    chains: [mainnet],
    ssr: true,
    transports: {
        [mainnet.id]: http('https://mainnet.infura.io/v3/242cb9e185294dffb6045558265f74a7'),
    },
});

export function Providers({ children }: { children: ReactNode }) {

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    <PriceProvider>
                        <NFTProvider>
                            <HeroUIProvider>
                                {children}
                            </HeroUIProvider>
                        </NFTProvider>
                    </PriceProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}