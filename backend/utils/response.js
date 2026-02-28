/**
 * Shared HTTP response helpers — enforce a consistent response shape across all controllers.
 *
 * Shape contract:
 *   success responses  →  { success: true, [message], data }
 *   paginated responses →  { success: true, data, pagination: { page, limit, total, totalPages } }
 *   error responses    →  handled by asyncHandler + AppError hierarchy (see errors/errorHandler.js)
 *
 * Usage:
 *   import { ok, created, paginated } from '../utils/response.js';
 *
 *   ok(res, data)                      // 200
 *   ok(res, data, 'Done')              // 200 + message
 *   created(res, data)                 // 201
 *   created(res, data, 'Created')      // 201 + message
 *   paginated(res, rows, { page, limit, total })  // 200 + pagination block
 */

/**
 * 200 OK — single resource or mutation result.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} [message]
 */
export const ok = (res, data, message) =>
  res.json({
    success: true,
    ...(message !== undefined ? { message } : {}),
    data,
  });

/**
 * 201 Created — newly created resource.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} [message]
 */
export const created = (res, data, message) =>
  res.status(201).json({
    success: true,
    ...(message !== undefined ? { message } : {}),
    data,
  });

/**
 * 200 OK — paginated list.
 * @param {import('express').Response} res
 * @param {Array}  data
 * @param {{ page: number, limit: number, total: number }} paginationInput
 */
export const paginated = (res, data, { page, limit, total }) =>
  res.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
