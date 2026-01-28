// Shared hook for API mode management
import { useState, useEffect } from 'react';

/**
 * Hook to manage API mode (real vs mock)
 * Centralizes the localStorage check that was duplicated across all hooks
 */
export function useApiMode() {
  const [useMockApi, setUseMockApi] = useState(() => {
    return localStorage.getItem('useMockApi') === 'true';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setUseMockApi(localStorage.getItem('useMockApi') === 'true');
    };

    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleApiMode = (mode: boolean) => {
    localStorage.setItem('useMockApi', mode.toString());
    setUseMockApi(mode);
    window.dispatchEvent(new Event('storage')); // Trigger update in other hooks
  };

  return { useMockApi, useRealApi: !useMockApi, toggleApiMode };
}
