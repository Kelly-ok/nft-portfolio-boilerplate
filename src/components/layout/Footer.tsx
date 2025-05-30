import Link from 'next/link';
import { ExternalLink, Heart, Code } from 'lucide-react';
import GitHubIcon from '@/components/icons/GitHubIcon';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 mt-10">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8 xl:col-span-1">
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                NFT Portfolio Dashboard
              </span>
            </Link>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Open-source NFT portfolio management platform with multi-marketplace integration. Built by Web3Market Team for the Web3 community.
            </p>

            {/* Web3Market Links */}
            <div className="flex flex-col space-y-3">
              <a
                href="https://web3market.site"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Web3Market.site - Official Website
              </a>
              <a
                href="https://github.com/web3marketsite/nft-portfolio-boilerplate"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                <GitHubIcon className="mr-2" size={16} />
                View Source Code
              </a>
            </div>

            {/* Open Source Badge */}
            <div className="flex items-center space-x-2 text-sm">
              <div className="flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                <Heart className="h-3 w-3 mr-1" />
                <span className="text-xs font-medium">Open Source</span>
              </div>
              <div className="flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                <Code className="h-3 w-3 mr-1" />
                <span className="text-xs font-medium">Free to Use</span>
              </div>
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Navigation</h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                      Dashboard
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Supported Marketplaces</h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <a
                      href="https://opensea.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                    >
                      <img
                        src="https://static.nftgo.io/marketplace/Opensea.svg"
                        alt="OpenSea"
                        className="h-4 w-4 mr-2"
                      />
                      OpenSea
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://looksrare.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                    >
                      <img
                        src="https://static.nftgo.io/marketplace/looksrare.svg"
                        alt="LooksRare"
                        className="h-4 w-4 mr-2"
                      />
                      LooksRare
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://nftgo.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                    >
                      <img
                        src="https://files.readme.io/cdb645a-Vertical.svg"
                        alt="NFTGo"
                        className="h-4 w-4 mr-2"
                        onError={(e) => {
                          // Fallback to a simple icon if NFTGo logo fails
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      NFTGo
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Powered By</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <a
                    href="https://nftgo.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                  >
                    <div className="h-4 w-4 mr-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-sm flex items-center justify-center">
                      <span className="text-white text-xs font-bold">N</span>
                    </div>
                    NFTGo API
                  </a>
                </li>
                <li>
                  <a
                    href="https://moralis.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                  >
                    <div className="h-4 w-4 mr-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-sm flex items-center justify-center">
                      <span className="text-white text-xs font-bold">M</span>
                    </div>
                    Moralis
                  </a>
                </li>
                <li>
                  <a
                    href="https://rainbowkit.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                  >
                    <div className="h-4 w-4 mr-2 bg-gradient-to-r from-pink-500 to-violet-500 rounded-sm flex items-center justify-center">
                      <span className="text-white text-xs font-bold">R</span>
                    </div>
                    RainbowKit
                  </a>
                </li>
                <li>
                  <a
                    href="https://nextjs.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                  >
                    <div className="h-4 w-4 mr-2 bg-black dark:bg-white rounded-sm flex items-center justify-center">
                      <span className="text-white dark:text-black text-xs font-bold">▲</span>
                    </div>
                    Next.js
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-zinc-200 dark:border-zinc-800 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                &copy; {new Date().getFullYear()} Web3Market Team. All rights reserved.
              </p>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Version 1.0.0</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">•</span>
                <a
                  href="https://github.com/web3marketsite/nft-portfolio-boilerplate/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  MIT License
                </a>
              </div>
            </div>

            <div className="flex items-center space-x-1 text-sm text-zinc-500 dark:text-zinc-400">
              <span>Built with</span>
              <Heart className="h-4 w-4 text-red-500 mx-1" />
              <span>by</span>
              <a
                href="https://web3market.site"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ml-1"
              >
                Web3Market Team
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}