import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import financeRepo from '../../repositories/FinanceRepository.js';
import jwt from 'jsonwebtoken';

vi.mock('../../repositories/FinanceRepository.js', () => ({
  default: {
    getFinancialSummary: vi.fn(),
  },
}));

describe('Finance Routes API', () => {
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

  it('GET /api/finance/summary should require authentication', async () => {
    const res = await request(app).get('/api/finance/summary');
    expect(res.status).toBe(401);
  });

  it('GET /api/finance/summary returns canonical summary shape', async () => {
    financeRepo.getFinancialSummary.mockResolvedValue({
      invoices: {
        total_invoices: 5,
        pending_count: 2,
        approved_count: 2,
        paid_count: 1,
        pending_amount: 1200,
        total_amount: 4800,
      },
      refunds: {
        total_refunds: 3,
        approved_count: 1,
        processed_count: 2,
        total_refund_amount: 900,
      },
      disputes: {
        total_disputes: 1,
        open_disputes: 1,
      },
    });

    const res = await request(app)
      .get('/api/finance/summary?range=month')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.timeRange).toBe('month');
    expect(res.body.data.invoices.pending_amount).toBe(1200);
    expect(res.body.data.refunds.total_refund_amount).toBe(900);
    expect(res.body.data.disputes.open_disputes).toBe(1);
    expect(financeRepo.getFinancialSummary).toHaveBeenCalledWith('30 days', orgId);
  });
});
