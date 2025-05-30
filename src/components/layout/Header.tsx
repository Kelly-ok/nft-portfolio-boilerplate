'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WalletConnect from '@/components/wallet/WalletConnect';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const navigation = [
  { name: 'Dashboard', href: '/' },
  { name: 'Marketplace', href: '/marketplace' },
  { name: 'Magic Eden', href: '/magiceden' },
  { name: 'Bulk Listing', href: '/bulk-listing' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Test Pricing', href: '/test-pricing' },
];

interface HeaderProps {
  onOpenWeb3MarketModal?: () => void;
}

export default function Header({ onOpenWeb3MarketModal }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="bg-white shadow-sm dark:bg-zinc-950 dark:border-b dark:border-zinc-800">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                NFT Dashboard
              </span>
            </Link>
            <div className="ml-10 hidden space-x-8 md:flex">
              {navigation.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    'text-sm font-medium transition-colors hover:text-blue-600',
                    pathname === link.href
                      ? 'text-blue-600'
                      : 'text-zinc-700 dark:text-zinc-300'
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {onOpenWeb3MarketModal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenWeb3MarketModal}
                className="flex items-center gap-2 text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
              >
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline">About</span>
              </Button>
            )}
            <WalletConnect />
          </div>
        </div>
        <div className="flex flex-wrap justify-center space-x-6 py-4 md:hidden">
          {navigation.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-blue-600',
                pathname === link.href
                  ? 'text-blue-600'
                  : 'text-zinc-700 dark:text-zinc-300'
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}