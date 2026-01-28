import { useEffect, useState } from 'react';
import { mockApi } from '@/api/mockData';

interface FinanceData {
  outstandingInvoices: number;
  refundsProcessed: number;
  disputes: number;
  payoutStatus: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    carrier: string;
    amount: number;
    status: string;
    dueDate: string;
  }>;
  refunds: Array<{
    id: string;
    orderNumber: string;
    amount: number;
    status: string;
    processedAt: string;
  }>;
}

export function useFinance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const useMock = localStorage.getItem('useMockApi') === 'true';

      try {
        if (useMock) {
          const response = await mockApi.getFinanceData();
          setData(response.data);
        } else {
          setData({
            outstandingInvoices: 0,
            refundsProcessed: 0,
            disputes: 0,
            payoutStatus: 'No payouts scheduled',
            invoices: [],
            refunds: [],
          });
        }
      } catch (error) {
        console.error('Failed to fetch finance data:', error);
        setData({
          outstandingInvoices: 0,
          refundsProcessed: 0,
          disputes: 0,
          payoutStatus: 'No payouts scheduled',
          invoices: [],
          refunds: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading };
}
