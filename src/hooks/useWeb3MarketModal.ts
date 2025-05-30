'use client';

import { useState, useEffect } from 'react';

const MODAL_STORAGE_KEY = 'web3market-modal-shown';

export function useWeb3MarketModal() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Check if modal has been shown before
    const hasBeenShown = localStorage.getItem(MODAL_STORAGE_KEY);
    
    if (!hasBeenShown) {
      // Show modal after a short delay for better UX
      const timer = setTimeout(() => {
        setIsModalOpen(true);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    // Mark as shown so it doesn't appear again
    localStorage.setItem(MODAL_STORAGE_KEY, 'true');
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  return {
    isModalOpen,
    closeModal,
    openModal,
  };
}
