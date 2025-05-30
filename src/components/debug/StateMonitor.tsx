'use client';

/**
 * StateMonitor Component
 *
 * A debug tool that displays the current state of the application.
 *
 * Configuration:
 * - The visibility of this component is controlled by the app.config.json file.
 * - To configure, modify the following settings in src/config/app.config.json:
 *   {
 *     "debug": {
 *       "showDebugTools": true,    // Set to false to completely disable debug tools
 *     }
 *   }
 *
 * - Debug tools will only be visible when process.env.NODE_ENV === 'development'
 */

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useBalance } from 'wagmi';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Eye, EyeOff } from 'lucide-react';
import { shouldShowDebugTools } from '@/lib/dev-utils';

export default function StateMonitor() {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const chainId = useChainId();
  const { data: balanceData } = useBalance({
    address: address,
  });

  // Check if debug tools should be shown based on environment
  useEffect(() => {
    setShouldShow(shouldShowDebugTools());
  }, []);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  // Don't render anything if debug tools should not be shown
  if (!shouldShow) {
    return null;
  }

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 opacity-50 hover:opacity-100"
        onClick={toggleVisibility}
      >
        <Eye className="h-4 w-4 mr-2" />
        Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm">Debug State Monitor</CardTitle>
          <Button variant="ghost" size="sm" onClick={toggleVisibility} className="h-6 w-6 p-0">
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <div className="font-semibold">Wallet:</div>
          <div className="font-mono break-all">
            {address ? address : 'Not connected'}
          </div>
        </div>
        <div>
          <div className="font-semibold">Connection Status:</div>
          <div>
            {isConnecting ? '🔄 Connecting...' :
             isReconnecting ? '🔄 Reconnecting...' :
             isConnected ? '✅ Connected' : '❌ Disconnected'}
          </div>
        </div>
        <div>
          <div className="font-semibold">Chain ID:</div>
          <div>{chainId}</div>
        </div>
        <div>
          <div className="font-semibold">Balance:</div>
          <div>
            {balanceData ?
              `${balanceData.value ? (Number(balanceData.value) / 10**18).toFixed(4) : '0'} ${balanceData.symbol}` :
              'Unknown'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
