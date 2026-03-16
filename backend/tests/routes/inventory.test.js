import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import InventoryRepository from '../../repositories/InventoryRepository.js';
import jwt from 'jsonwebtoken';

// Mock the repository so we don't hit the real DB for route testing
vi.mock('../../repositories/InventoryRepository.js', () => ({
    default: {
        findInventory: vi.fn(),
        createInventoryItem: vi.fn(),
        addStock: vi.fn(),
        findByIdWithDetails: vi.fn(),
        recordMovement: vi.fn()
    }
}));

// Mock permissions middleware partially if necessary, but 
// we will just provide a system_admin token to bypass RBAC issues.
describe('Inventory Routes API', () => {
    const orgId = '44444444-4444-4444-4444-444444444444';
    let authToken;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create token mirroring the app's standard JWT layout
        // We assume JWT_SECRET is available in test environment, or fallback matching the code
        authToken = jwt.sign(
            { userId: 'test-admin', organizationId: orgId, role: 'admin' },
            process.env.JWT_SECRET || 'your_jwt_secret_here', // server.js or auth.js uses process.env.JWT_SECRET
            { expiresIn: '1h' }
        );
    });

    it('GET /api/inventory should require authentication', async () => {
        const res = await request(app).get('/api/inventory');
        expect(res.status).toBe(401);
    });

    it('GET /api/inventory returns mocked data', async () => {
        InventoryRepository.findInventory.mockResolvedValue({
            items: [
                { id: 'inv-1', sku: 'MOCK-1', quantity: 10, available_quantity: 10 }
            ],
            totalCount: 1
        });

        const res = await request(app)
            .get('/api/inventory')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].sku).toBe('MOCK-1');
    });
});
