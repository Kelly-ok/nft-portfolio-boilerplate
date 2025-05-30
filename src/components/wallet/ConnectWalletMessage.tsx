'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';

export default function ConnectWalletMessage() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-[50vh]">
      <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-4 mb-4">
        <Wallet className="h-8 w-8 text-blue-500 dark:text-blue-400" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        Connect your wallet to view your NFT collection and manage your listings across marketplaces.
      </p>
      <ConnectButton />
    </div>
  );
}
