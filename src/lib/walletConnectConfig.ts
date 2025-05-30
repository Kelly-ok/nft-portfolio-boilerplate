/**
 * WalletConnect Configuration Utility
 * 
 * This file contains utilities to configure WalletConnect and prevent common issues:
 * 1. Prevents multiple initializations of WalletConnect Core
 * 2. Increases the maximum number of event listeners to prevent memory leak warnings
 */

import { EventEmitter } from 'events';

// Track if WalletConnect has been initialized
let walletConnectInitialized = false;

/**
 * Configure EventEmitter to increase max listeners
 * This prevents the MaxListenersExceededWarning
 */
export function configureEventEmitter() {
  // Set higher limit for EventEmitter instances to prevent warnings
  EventEmitter.defaultMaxListeners = 20;
}

/**
 * Check if WalletConnect is already initialized
 * @returns {boolean} Whether WalletConnect has been initialized
 */
export function isWalletConnectInitialized(): boolean {
  return walletConnectInitialized;
}

/**
 * Mark WalletConnect as initialized
 * This helps prevent multiple initializations
 */
export function markWalletConnectInitialized() {
  walletConnectInitialized = true;
}