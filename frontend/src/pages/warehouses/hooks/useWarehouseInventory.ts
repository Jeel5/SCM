import { useEffect, useState } from 'react';
import { warehousesApi } from '@/api/services';
import type { InventoryItem } from '@/types';

export function useWarehouseInventory(warehouseId: string | undefined) {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);

    useEffect(() => {
        if (!warehouseId) {
            setInventory([]);
            setTotalItems(0);
            return;
        }

        const fetchInventory = async () => {
            setIsLoading(true);
            try {
                const response = await warehousesApi.getWarehouseInventory(warehouseId, 1, 50); // Fetch up to 50 items for modal preview
                setInventory(response.data);
                setTotalItems(response.total);
            } catch (error) {
                console.error('Failed to fetch warehouse inventory:', error);
                setInventory([]);
                setTotalItems(0);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInventory();
    }, [warehouseId]);

    return { inventory, totalItems, isLoading };
}
