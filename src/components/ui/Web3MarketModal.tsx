'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { X, ExternalLink, Star, Code, Heart } from 'lucide-react';
import GitHubIcon from '@/components/icons/GitHubIcon';

interface Web3MarketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Web3MarketModal({ isOpen, onClose }: Web3MarketModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto rounded-xl sm:rounded-2xl bg-white dark:bg-zinc-900 p-4 sm:p-6 lg:p-8 shadow-2xl border border-zinc-200 dark:border-zinc-700"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute top-2 right-2 sm:top-3 sm:right-3 lg:top-4 lg:right-4 p-1.5 sm:p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 z-10"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            {/* Header */}
            <div className="text-center mb-4 sm:mb-6 pr-8 sm:pr-0">
              <div className="flex items-center justify-center mb-3 sm:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <Code className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
                </div>
              </div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent mb-1 sm:mb-2">
                Welcome to NFT Portfolio
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                Open-source boilerplate by Web3Market Team
              </p>
            </div>

            {/* Content */}
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <div className="flex items-start gap-2 sm:gap-3">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Free & Open Source
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                    This is a completely free, open-source boilerplate that you can use, modify, and distribute without any restrictions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Built with Love
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                    Crafted by the Web3Market Team with modern technologies and best practices for the Web3 community.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <Code className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Production Ready
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                    Complete with multi-marketplace integration, wallet connectivity, and modern UI components.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                onClick={() => window.open('https://web3market.site', '_blank')}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm sm:text-base py-2 sm:py-2.5"
              >
                <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="truncate">Visit Web3Market.site</span>
              </Button>

              <Button
                onClick={() => window.open('https://github.com/web3marketsite/nft-portfolio-boilerplate', '_blank')}
                variant="outline"
                className="flex-1 text-sm sm:text-base py-2 sm:py-2.5"
              >
                <GitHubIcon className="mr-1.5 sm:mr-2" size={14} />
                <span className="truncate">View on GitHub</span>
              </Button>
            </div>

            {/* Footer */}
            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-zinc-200 dark:border-zinc-700 text-center">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
