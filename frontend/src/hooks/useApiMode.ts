// Shared hook for API mode management
import { useState, useEffect } from 'react';

/**
 * Hook to manage API mode (real vs mock)
 * Centralizes the localStorage check that was duplicated across all hooks
 */
export function useApiMode() {
  const allowMockApi =
    import.meta.env.DEV ||
    String(import.meta.env.VITE_ENABLE_MOCK_DEMO || '').toLowerCase() === 'true';
  const [useMockApi, setUseMockApi] = useState(() => {
    if (!allowMockApi) return false;
    return localStorage.getItem('useMockApi') === 'true';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      if (!allowMockApi) {
        setUseMockApi(false);
        return;
      }
      setUseMockApi(localStorage.getItem('useMockApi') === 'true');
    };

    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleApiMode = (mode: boolean) => {
    if (!allowMockApi) {
      setUseMockApi(false);
      return;
    }
    localStorage.setItem('useMockApi', mode.toString());
    setUseMockApi(mode);
    window.dispatchEvent(new Event('storage')); // Trigger update in other hooks
  };

  return { useMockApi, useRealApi: !useMockApi, toggleApiMode };
}
