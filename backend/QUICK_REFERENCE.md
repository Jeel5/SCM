# Backend Quick Reference

## Run Commands
From `backend/`:

```bash
npm install
npm run dev
npm test
npm start
```

## Key Files
- Entry point: `server.js`
- DB pool: `config/db.js`
- RBAC model: `config/permissions.js`
- Auth middleware: `middlewares/auth.js`
- Error handler: `errors/errorHandler.js`
- Logger: `utils/logger.js`

## Core Middleware Order
1. `helmet`
2. `cors`
3. `express.json` / `express.urlencoded`
4. `cookieParser`
5. request ID + request logger + slow request logger
6. global rate limiter
7. auth route limiter
8. user rate limiter
9. routes
10. not found handler
11. global error handler

## Permission Format
Use dot notation:
- `dashboard.view`
- `orders.view|create|update`
- `shipments.view|create|update`
- `jobs.view|create|update|delete`
- `sla.view|manage`

## Common Patterns
- Controller success response:

```js
res.json({ success: true, data });
```

- Throw a typed error in services:

```js
throw new ValidationError('Invalid status transition');
```

- Validate request body in route:

```js
router.post('/orders', authenticate, authorize('orders.create'), validateRequest(createOrderSchema), createOrder);
```

## Jobs and Scheduling
- Queue: BullMQ (`queues/index.js`)
- Worker bootstrap: `jobs/jobWorker.js`
- Cron sync and run: `jobs/cronScheduler.js`
- Service facade: `services/jobsService.js`

## Troubleshooting
- Auth failures not showing in frontend toasts:
  - Ensure response uses `{ success: false, message: '...' }`.
- Permission denied unexpectedly:
  - Verify route permission string exists in `config/permissions.js`.
  - Confirm JWT role is mapped in `ROLE_PERMISSIONS`.
- Timeline endpoint mismatch:
  - By shipment ID: `GET /api/shipments/:id/timeline`
  - By tracking number: `GET /api/shipments/tracking/:trackingNumber/timeline`
