import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db.js';
import CarrierRepository from '../../repositories/CarrierRepository.js';

describe('CarrierRepository', () => {
    const orgId = '33333333-3333-3333-3333-333333333333'; // Mock UUID

    it('createCarrier inserts a new carrier correctly', async () => {
        await withTestDb(async (client) => {
            // Setup: need an org
            await client.query(`
        INSERT INTO organizations (id, name, code)
        VALUES ($1, 'Carrier Test Org', 'CARRIER-ORG')
        ON CONFLICT DO NOTHING
      `, [orgId]);

            // Create new carrier
            const carrier = await CarrierRepository.createCarrier({
                organization_id: orgId,
                code: 'TEST-FEDEX',
                name: 'Test FedEx',
                service_type: 'express',
                contact_email: 'test@fedex.com',
                reliability_score: 0.98
            }, client);

            expect(carrier.id).toBeDefined();
            expect(carrier.code).toBe('TEST-FEDEX');
            expect(carrier.name).toBe('Test FedEx');
            expect(carrier.service_type).toBe('express');
            expect(Number(carrier.reliability_score)).toBe(0.98);
            expect(carrier.is_active).toBe(true);
            expect(carrier.availability_status).toBe('available');

            // Find it to ensure it was saved
            const found = await CarrierRepository.findByCode('TEST-FEDEX', orgId, client);
            expect(found).not.toBeNull();
            expect(found.code).toBe('TEST-FEDEX');
        });
    });

    it('updateCarrier correctly updates fields', async () => {
        await withTestDb(async (client) => {
            // Setup
            await client.query(`
        INSERT INTO organizations (id, name, code)
        VALUES ($1, 'Carrier Test Org 2', 'CARRIER-ORG-2')
        ON CONFLICT DO NOTHING
      `, [orgId]);

            const carrier = await CarrierRepository.createCarrier({
                organization_id: orgId,
                code: 'TEST-UPS',
                name: 'Test UPS',
            }, client);

            // Update
            const updated = await CarrierRepository.updateCarrier(carrier.id, {
                name: 'Test UPS Updated',
                availability_status: 'busy',
                reliability_score: 0.95
            }, client);

            expect(updated.name).toBe('Test UPS Updated');
            expect(updated.availability_status).toBe('busy');
            expect(Number(updated.reliability_score)).toBe(0.95);

            // Other fields should not change
            expect(updated.code).toBe('TEST-UPS');
        });
    });
});
