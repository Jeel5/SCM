import pool from '../../configs/db.js';

/**
 * Helper to run repository tests in an isolated transaction.
 * It begins a transaction, yields the client, and safely rolls back afterwards.
 */
export async function withTestDb(testFn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await testFn(client);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}
