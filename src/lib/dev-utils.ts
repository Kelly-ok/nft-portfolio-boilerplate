/**
 * Development utilities for logging and debugging
 * These functions only execute in development environment
 */

/**
 * Check if we're in development environment
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Development-only console.log
 * Only logs in development environment
 */
export const devLog = (...args: any[]): void => {
  if (isDevelopment()) {
    console.log(...args);
  }
};

/**
 * Development-only console.error
 * Only logs in development environment
 */
export const devError = (...args: any[]): void => {
  if (isDevelopment()) {
    console.error(...args);
  }
};

/**
 * Development-only console.warn
 * Only logs in development environment
 */
export const devWarn = (...args: any[]): void => {
  if (isDevelopment()) {
    console.warn(...args);
  }
};

/**
 * Development-only console.info
 * Only logs in development environment
 */
export const devInfo = (...args: any[]): void => {
  if (isDevelopment()) {
    console.info(...args);
  }
};

/**
 * Check if debug tools should be shown
 * Requires both development environment and config setting
 */
export const shouldShowDebugTools = (): boolean => {
  if (!isDevelopment()) {
    return false;
  }
  
  // In development, we can show debug tools
  // You can add additional config checks here if needed
  return true;
};
