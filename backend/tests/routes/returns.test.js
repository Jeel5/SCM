import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import ReturnRepository from '../../repositories/ReturnRepository.js';
import jwt from 'jsonwebtoken';

vi.mock('../../repositories/ReturnRepository.js', () => ({
  default: {
    findReturnsWithDetails: vi.fn(),
    getReturnStatusStats: vi.fn(),
  },
}));

describe('Returns Routes API', () => {
  const orgId = '44444444-4444-4444-4444-444444444444';
  let authToken;

  beforeEach(() => {
    vi.clearAllMocks();

    authToken = jwt.sign(
      { userId: 'test-admin', organizationId: orgId, role: 'admin' },
      process.env.JWT_SECRET || 'your_jwt_secret_here',
      { expiresIn: '1h' }
    );
  });

  it('GET /api/returns should require authentication', async () => {
    const res = await request(app).get('/api/returns');
    expect(res.status).toBe(401);
  });

  it('GET /api/returns returns canonical list and stats shape', async () => {
    ReturnRepository.findReturnsWithDetails.mockResolvedValue({
      returns: [
        {
          id: 'ret-1',
          rma_number: 'RMA-001',
          order_id: 'ord-1',
          order_number: 'ORD-001',
          reason: 'damaged',
          status: 'requested',
          refund_amount: 499,
          restocking_fee: 0,
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          items: [{ sku: 'SKU-1', quantity: 1 }],
          quality_check_notes: null,
          requested_at: '2026-03-18T00:00:00.000Z',
          created_at: '2026-03-18T00:00:00.000Z',
          approved_at: null,
          resolved_at: null,
        },
      ],
      totalCount: 1,
    });

    ReturnRepository.getReturnStatusStats.mockResolvedValue({
      total_returns: 1,
      pending: 1,
      approved: 0,
      rejected: 0,
      completed: 0,
    });

    const res = await request(app)
      .get('/api/returns?page=1&limit=20&status=requested')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats.totalReturns).toBe(1);
    expect(res.body.stats.pending).toBe(1);
    expect(res.body.stats.requested).toBe(1);
    expect(res.body.data[0].rmaNumber).toBe('RMA-001');
    expect(res.body.pagination.total).toBe(1);
    expect(ReturnRepository.findReturnsWithDetails).toHaveBeenCalled();
    expect(ReturnRepository.getReturnStatusStats).toHaveBeenCalledWith(orgId);
  });
});
