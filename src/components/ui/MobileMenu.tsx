'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { X, Menu, Info, ExternalLink } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface MobileMenuProps {
  onOpenWeb3MarketModal: () => void;
}

export default function MobileMenu({ onOpenWeb3MarketModal }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleAboutClick = () => {
    onOpenWeb3MarketModal();
    setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger Button - Only visible on mobile */}
      <div className="sm:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Slide-in Menu */}
            <motion.div
              className="fixed top-0 right-0 z-50 h-full w-80 max-w-[85vw] bg-white dark:bg-zinc-900 shadow-2xl sm:hidden"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ 
                type: 'spring', 
                damping: 25, 
                stiffness: 300,
                duration: 0.4 
              }}
            >
              {/* Menu Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4 text-white fill-current"
                      aria-hidden="true"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                      Web3Market
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      NFT Portfolio
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Menu Content */}
              <div className="flex flex-col h-full">
                {/* Main Actions */}
                <div className="p-4 space-y-4">
                  {/* About Button */}
                  <Button
                    variant="ghost"
                    onClick={handleAboutClick}
                    className="w-full justify-start gap-3 p-4 h-auto text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Info className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="font-medium">About</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        Learn about this project
                      </div>
                    </div>
                  </Button>

                  {/* Connect Wallet */}
                  <div className="w-full">
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Wallet Connection
                    </div>
                    <div className="w-full">
                      <ConnectButton />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-zinc-200 dark:border-zinc-700 mx-4" />

                {/* Social Links */}
                <div className="p-4 space-y-4">
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Follow Web3Market
                  </h3>
                  
                  {/* Twitter/X */}
                  <Button
                    variant="ghost"
                    onClick={() => window.open('https://x.com/Web3Market_site', '_blank')}
                    className="w-full justify-start gap-3 p-4 h-auto text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5 fill-current"
                        aria-hidden="true"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Twitter / X</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        @Web3Market_site
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-auto text-zinc-400" />
                  </Button>

                  {/* Website */}
                  <Button
                    variant="ghost"
                    onClick={() => window.open('https://web3market.site', '_blank')}
                    className="w-full justify-start gap-3 p-4 h-auto text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5 fill-none stroke-current"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                        <path d="M2 12h20" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Official Website</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        web3market.site
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-auto text-zinc-400" />
                  </Button>
                </div>

                {/* Footer */}
                <div className="mt-auto p-4 border-t border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                    Made with ❤️ by{' '}
                    <a
                      href="https://web3market.site"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 font-medium"
                    >
                      Web3Market Team
                    </a>
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-1">
                    Version 1.0.0 • Open Source
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
