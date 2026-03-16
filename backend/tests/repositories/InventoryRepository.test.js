import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db.js';
import InventoryRepository from '../../repositories/InventoryRepository.js';

describe('InventoryRepository', () => {
    const orgId = '11111111-1111-1111-1111-111111111111'; // Mock UUID
    const whId = '22222222-2222-2222-2222-222222222222';  // Mock UUID

    it('createInventoryItem correctly handles upserts', async () => {
        await withTestDb(async (client) => {
            // Setup: need an org and warehouse for FK constraints.
            await client.query(`
        INSERT INTO organizations (id, name, code)
        VALUES ($1, 'Test Org', 'TEST-ORG')
        ON CONFLICT DO NOTHING
      `, [orgId]);

            await client.query(`
        INSERT INTO warehouses (id, organization_id, code, name, address)
        VALUES ($1, $2, 'TEST-WH', 'Test Warehouse', '{"city": "Test"}')
      `, [whId, orgId]);

            // 1. Create new item
            const item1 = await InventoryRepository.createInventoryItem({
                organization_id: orgId,
                warehouse_id: whId,
                sku: 'TEST-SKU-1',
                product_name: 'Test Product 1',
                quantity: 100,
                reorder_point: 20
            }, client);

            expect(item1.sku).toBe('TEST-SKU-1');
            expect(item1.quantity).toBe(100);
            expect(item1.available_quantity).toBe(100);
            expect(item1.reorder_point).toBe(20);

            // 2. Upsert (update existing on SKU conflict)
            const item2 = await InventoryRepository.createInventoryItem({
                warehouse_id: whId,
                sku: 'TEST-SKU-1',
                quantity: 150,
                available_quantity: 140,
                reserved_quantity: 10,
                reorder_point: 30
            }, client);

            expect(item2.id).toBe(item1.id); // Same row
            // Upsert path is additive by design (existing + incoming)
            expect(item2.quantity).toBe(250);
            expect(item2.available_quantity).toBe(240);
            expect(item2.reserved_quantity).toBe(10);
            expect(item2.reorder_point).toBe(30);
        });
    });

    it('reserveStock moves available to reserved', async () => {
        await withTestDb(async (client) => {
            await client.query(`
        INSERT INTO organizations (id, name, code)
        VALUES ($1, 'Test Org 2', 'TEST-ORG-2')
        ON CONFLICT DO NOTHING
      `, [orgId]);

            await client.query(`
        INSERT INTO warehouses (id, organization_id, code, name, address)
        VALUES ($1, $2, 'TEST-WH-2', 'Test Warehouse 2', '{"city": "Test"}')
      `, [whId, orgId]);

            await InventoryRepository.createInventoryItem({
                warehouse_id: whId,
                sku: 'TEST-SKU-2',
                quantity: 50,
                available_quantity: 50
            }, client);

            // Reserve 10 units
            const reserved = await InventoryRepository.reserveStock('TEST-SKU-2', whId, 10, client);
            expect(reserved).toBeDefined();
            expect(reserved.quantity).toBe(50);
            expect(reserved.available_quantity).toBe(40);
            expect(reserved.reserved_quantity).toBe(10);

            // Try reserving more than available (should return null/fail)
            const failed = await InventoryRepository.reserveStock('TEST-SKU-2', whId, 100, client);
            expect(failed).toBeNull();
        });
    });
});
