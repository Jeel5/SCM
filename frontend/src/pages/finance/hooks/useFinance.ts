import { useEffect, useState, useCallback, useRef } from 'react';
import { financeApi } from '@/api/services';
import { mockApi } from '@/api/mockData';
import { useApiMode } from '@/hooks';
import { useSocketEvent } from '@/hooks/useSocket';
import { notifyLoadError } from '@/lib/apiErrors';

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
  const { useMockApi } = useApiMode();
  const [refreshKey, setRefreshKey] = useState(0);

  const isSoftRefresh = useRef(false);
  const refetch = useCallback(() => {
    isSoftRefresh.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const isSoft = isSoftRefresh.current;
    isSoftRefresh.current = false;
    const fetchData = async () => {
      if (!isSoft) setIsLoading(true);

      try {
        if (useMockApi) {
          const response = await mockApi.getFinanceData();
          setData(response.data);
        } else {
          // Fetch real data from backend
          const [summaryRes, invoicesRes, refundsRes] = await Promise.all([
            financeApi.getSummary(),
            financeApi.getInvoices(1, 20),
            financeApi.getRefunds(1, 20),
          ]);

          const summary = summaryRes.data;

          setData({
            outstandingInvoices: summary?.invoices?.outstanding_amount || 0,
            refundsProcessed: summary?.refunds?.total_amount || 0,
            disputes: summary?.disputes?.open || 0,
            payoutStatus: summary?.disputes?.open
              ? `${summary.disputes.open} disputes open`
              : 'All clear',
            invoices: (invoicesRes.data || []).map((inv: any) => ({
              id: inv.id,
              invoiceNumber: inv.invoice_number,
              carrier: inv.carrier_name || inv.carrier_id,
              amount: parseFloat(inv.final_amount || inv.base_amount || 0),
              status: inv.status,
              dueDate: inv.billing_period_end
                ? new Date(inv.billing_period_end).toLocaleDateString()
                : 'N/A',
            })),
            refunds: (refundsRes.data || []).map((ref: any) => ({
              id: ref.id,
              orderNumber: ref.rma_number || ref.order_id,
              amount: parseFloat(ref.refund_amount || 0),
              status: ref.status === 'refunded' ? 'processed' : 'pending',
              processedAt: ref.completed_at
                ? new Date(ref.completed_at).toLocaleDateString()
                : 'Pending',
            })),
          });
        }
      } catch (error) {
        if (!isSoft) notifyLoadError('finance data', error);
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
  }, [refreshKey]);

  useSocketEvent('order:updated', refetch);
  useSocketEvent('shipment:updated', refetch);
  useSocketEvent('return:updated', refetch);
  useSocketEvent('return:created', refetch);

  return { data, isLoading, refetch };
}
