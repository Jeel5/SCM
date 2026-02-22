# 📚 Quick Reference: What Each File Does

This is a quick lookup guide for absolute beginners. Every file explained in ONE sentence.

---

## 🎯 Main Entry Point

| File | What It Does |
|------|-------------|
| `server.js` | **STARTS EVERYTHING** - Initializes the web server and connects all parts together |

---

## ⚙️ Configuration

| File | What It Does |
|------|-------------|
| `configs/db.js` | Creates connection pool to PostgreSQL database |
| `.env` | Stores secret configuration (passwords, API keys) - NOT in version control |

---

## 🎮 Controllers (HTTP Handlers)

**Purpose**: Receive HTTP requests, send HTTP responses

| File | Handles |
|------|---------|
| `controllers/usersController.js` | Login, logout, user profile, user management |
| `controllers/ordersController.js` | Order CRUD (Create, Read, Update, Delete) |
| `controllers/inventoryController.js` | Stock levels, inventory adjustments |
| `controllers/shipmentsController.js` | Shipment tracking, status updates |
| `controllers/returnsController.js` | Product returns, refunds |
| `controllers/slaController.js` | SLA policies, violations, exceptions |
| `controllers/jobsController.js` | Background jobs, job status |
| `controllers/dashboardController.js` | Dashboard statistics |
| `controllers/analyticsController.js` | Analytics queries and reports |
| `controllers/mdmController.js` | Carriers, warehouses, products (master data) |
| `controllers/assignmentController.js` | Carrier assignment: request, accept, reject, busy |
| `controllers/webhooksController.js` | Incoming webhooks from e-commerce platforms |
| `controllers/financeController.js` | Invoices, billing, cost tracking |
| `controllers/trackingController.js` | Shipment tracking events (from carrier) |
| `controllers/organizationController.js` | Organization management (superadmin) |
| `controllers/companiesController.js` | Company management (superadmin) |

---

## 💼 Services (Business Logic)

**Purpose**: Contains business rules, orchestrates operations

| File | What It Does |
|------|-------------|
| `services/orderService.js` | Order processing logic, inventory reservation, transactions |

| `services/carrierAssignmentService.js` | **Core**: find carriers, create assignment rows, accept/reject/busy/retry |
| `services/assignmentRetryService.js` | Handles expired/rejected batches — triggers next batch of 3 carriers |
| `services/orderService.js` | Order creation with inventory reservation and transaction management |
| `services/jobsService.js` | CRUD for background_jobs and cron_schedules tables |
| `services/slaService.js` | SLA violation detection and monitoring |
| `services/exceptionService.js` | Exception lifecycle: create, escalate, resolve |
| `services/returnsService.js` | Return request processing and refund logic |
| `services/invoiceService.js` | Carrier invoice generation |
| `services/notificationService.js` | Email/SMS/push notification dispatch |
| `services/shipmentTrackingService.js` | Tracking event ingestion and shipment status sync |
| `services/carrierPayloadBuilder.js` | Builds the JSON payload sent to carrier systems |
| `services/deliveryChargeService.js` | Zone-based delivery charge calculation |
| `services/carrierRateService.js` | Carrier rate fetching and caching |
| `services/osrmService.js` | OSRM routing service for distance-based estimates |
| `services/settingsService.js` | User and org settings read/write |
| `services/alertService.js` | Rule-based alert evaluation and dispatch |
| `services/allocationService.js` | Inventory allocation to orders |
| `services/webhookSimulator.js` | CLI tool for generating mock webhook traffic |

---

## 🗃️ Repositories (Database Queries)

**Purpose**: All SQL queries live here

| File | What It Does |
|------|-------------|
| `repositories/BaseRepository.js` | Common CRUD operations all repos inherit |
| `repositories/OrderRepository.js` | Order-specific database queries |
| `repositories/InventoryRepository.js` | Inventory stock queries (reserve, release, adjust) |
| `repositories/ShipmentRepository.js` | Shipment tracking queries |
| `repositories/UserRepository.js` | User authentication and management queries |
| `repositories/ReturnRepository.js` | Return and refund queries |
| `repositories/index.js` | Exports all repositories for easy importing |

---

## 🛡️ Middlewares (Request Processors)

**Purpose**: Process requests BEFORE they reach route handlers

| File | What It Does |
|------|-------------|
| `middlewares/auth.js` | `authenticate()` — checks JWT; `authorize()` — role check; `optionalAuth()` — optional |
| `middlewares/rbac.js` | `requirePermission()` — permission-string guard; `ROLES` constants; full permission matrix |
| `middlewares/requestLogger.js` | `requestId()` — UUID per request; `requestLogger()` — structured log; `slowRequestLogger()` |
| `middlewares/multiTenant.js` | `injectOrgContext()` — sets `req.organizationId` from JWT for multi-tenant queries |
| `middlewares/webhookOrgContext.js` | `resolveWebhookOrg()` — validates `:orgToken` URL param, sets `req.webhookOrganizationId` |
| `middlewares/webhookAuth.js` | `verifyWebhookSignature()` — HMAC-SHA256 verification for carrier endpoints |

**Order matters!** Middleware runs in the order you add it in `server.js`

---

## 🛣️ Routes (URL Definitions)

**Purpose**: Define which URL calls which controller

| File | URLs It Handles |
|------|----------------|
| `routes/users.js` | `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/users` |
| `routes/orders.js` | `/api/orders`, `/api/orders/:id`, `/api/orders/:id/status`, `/api/orders/transfer` |
| `routes/assignments.js` | `/api/orders/:id/request-carriers`, `/api/carriers/assignments/pending`, `/api/assignments/:id/accept|reject|busy` |
| `routes/inventory.js` | `/api/inventory`, `/api/inventory/adjust`, `/api/inventory/:id/history` |
| `routes/shipments.js` | `/api/shipments`, `/api/shipments/:id`, `/api/shipments/:id/tracking-event` |
| `routes/returns.js` | `/api/returns`, `/api/returns/:id`, `/api/returns/:id/status` |
| `routes/sla.js` | `/api/sla/violations`, `/api/sla/metrics`, `/api/sla/exceptions` |
| `routes/jobs.js` | `/api/jobs`, `/api/jobs/:id`, `/api/jobs/cron` |
| `routes/mdm.js` | `/api/warehouses`, `/api/carriers`, `/api/products`, `/api/sla-policies` |
| `routes/finance.js` | `/api/finance/summary`, `/api/finance/invoices` |
| `routes/webhooks.js` | `/api/webhooks/:orgToken/orders|inventory|returns|tracking`, and legacy no-token variants |
| `routes/carriers.js` | `/api/carriers/:code/tracking`, `/api/carriers/:code/availability` (HMAC) |
| `routes/shipping.js` | `/api/shipping/quote/estimate`, `/api/shipping/quote/real` |
| `routes/organizations.js` | `/api/organizations/:id` (superadmin) |
| `routes/companies.js` | `/api/companies` (superadmin) |
| `routes/demo.js` | `/api/demo/organizations|carriers|carrier-shipments|carrier-secret` (dev only) |

---

## ✅ Validators (Input Validation)

**Purpose**: Check if incoming data is valid

| File | What It Validates |
|------|------------------|
| `validators/index.js` | Validation framework + middleware functions |
| `validators/orderSchemas.js` | Order creation/update data |
| `validators/shipmentSchemas.js` | Shipment creation/update data |
| `validators/inventorySchemas.js` | Inventory adjustment data |
| `validators/userSchemas.js` | Login/registration data |
| `validators/returnSchemas.js` | Return creation data |

---

## ❌ Errors (Error Handling)

**Purpose**: Standardize error responses

| File | What It Does |
|------|-------------|
| `errors/AppError.js` | Defines 10 custom error classes (NotFoundError, ValidationError, etc.) |
| `errors/errorHandler.js` | Global error handler - catches ALL errors, formats responses |
| `errors/errorUtils.js` | Helper functions (assertExists, throwIf, asyncHandler) |
| `errors/index.js` | Exports all error utilities |

**Error Flow**: `throw new NotFoundError('Order')` → Global handler catches → Sends JSON response

---

## 🛠️ Utils (Helper Functions)

**Purpose**: Reusable utilities

| File | What It Does |
|------|-------------|
| `utils/logger.js` | Pino + Winston logging — `logger.info/warn/error()`, `logAuth()` helper |
| `utils/jwt.js` | `generateAccessToken()`, `generateRefreshToken()`, `verifyAccessToken()` |
| `utils/dbTransaction.js` | `withTransaction(async fn)` — PostgreSQL transaction helper |

---

## 📊 Logs (Log Files)

**Purpose**: Track what happens in the system

| File | Contains |
|------|----------|
| `logs/error.log` | Only error messages |
| `logs/combined.log` | All log messages (info, warnings, errors) |
| `logs/http.log` | HTTP request/response logs |
| `logs/README.md` | Documentation about log files |

**Log Rotation**: Files automatically rotate when they reach 5MB

---

## 📄 Documentation

| File | Purpose |
|------|---------|
| `CODE_GUIDE.md` | **Comprehensive guide for beginners** (you should read this!) |
| `RBAC.md` | Role-based access control documentation |
| `ARCHITECTURE.md` | System architecture and design decisions |
| `README.md` | Project overview and setup instructions |

---

## 🔄 Request Flow Example

Let's trace what happens when you **create an order**:

```
1. Frontend sends: POST /api/orders
   Body: {customer_name: "John", items: [...]}

2. server.js receives request
   ↓
3. Middleware runs:
   - helmet() adds security headers
   - cors() checks if request is from allowed origin  
   - express.json() parses JSON body
   - requestId() assigns unique ID
   - requestLogger() logs request start
   
4. Router matches: routes/orders.js
   ↓
5. Route middleware runs:
   - authenticate() checks JWT token
   - authorize('orders:create') checks permission
   - validateRequest(schema) checks data is valid
   
6. Controller runs: ordersController.createOrder()
   - Receives req.body
   - Calls service layer
   ↓
7. Service runs: orderService.createOrder()
   - Applies business rules
   - Starts database transaction
   - Calls repositories
   ↓
8. Repository runs: OrderRepository.createOrderWithItems()
   - Executes SQL INSERT
   - Returns new order data
   ↓
9. Service commits transaction
   - Logs event
   - Returns order to controller
   ↓
10. Controller sends response:
    Status: 201 Created
    Body: {success: true, data: {id: 123, ...}}
    
11. Middleware runs again:
    - requestLogger() logs completion time
    - Response sent to frontend!
```

**Total time**: Usually 20-100ms

---

## 🎓 Learning Order

If you're new, study files in this order:

### Week 1: Basics
1. `server.js` - See the big picture
2. `routes/users.js` - Simple route definitions
3. `controllers/usersController.js` - Login logic
4. `middlewares/auth.js` - How authentication works
5. `CODE_GUIDE.md` - Read this thoroughly!

### Week 2: Data Flow
6. `repositories/UserRepository.js` - Database queries
7. `validators/userSchemas.js` - Input validation
8. `errors/AppError.js` - Error types
9. `utils/logger.js` - Logging system
10. `utils/jwt.js` - Token creation

### Week 3: Complex Features
11. `services/orderService.js` - Business logic
12. `repositories/OrderRepository.js` - Complex queries
13. `middlewares/rbac.js` - Permissions
14. `errors/errorHandler.js` - Error handling
15. `RBAC.md` - Role system

### Week 4: Advanced
16. `repositories/BaseRepository.js` - Inheritance
17. `validators/index.js` - Validation framework
18. Pick any other repository/controller
19. Trace a full request end-to-end
20. Try adding a new feature!

---

## 💡 Pro Tips

### Finding Code
- Need to add a new API endpoint? → Start in `routes/`
- Need to change business logic? → Look in `services/`
- Need to change a query? → Look in `repositories/`
- Getting an error? → Check `logs/error.log`

### Reading Error Messages
```
at orderService.createOrder (services/orderService.js:45)
│      │             │                    │                │
│      │             │                    │                Line number
│      │             │                    File
│      │             Function name
│      Object/Class
```

### Common Patterns to Recognize

**Pattern 1**: Async/Await
```javascript
async function getOrder(id) {
  const order = await OrderRepository.findById(id);
  return order;
}
```
`await` = "wait for this to finish before continuing"

**Pattern 2**: Destructuring
```javascript
const { id, email, role } = req.user;
// Same as:
// const id = req.user.id;
// const email = req.user.email;
// const role = req.user.role;
```

**Pattern 3**: Arrow Functions
```javascript
app.use((req, res, next) => {
  // This is a function
  next();
});
```

**Pattern 4**: Template Literals
```javascript
const message = `Order ${id} created`;
// Same as: "Order " + id + " created"
```

---

## 🚨 Common Mistakes

1. **Forgetting `await`**
   ```javascript
   // WRONG - returns Promise, not data!
   const order = OrderRepository.findById(id);
   
   // RIGHT
   const order = await OrderRepository.findById(id);
   ```

2. **Not handling errors**
   ```javascript
   // WRONG - error crashes server
   async function getOrder(id) {
     const order = await OrderRepository.findById(id);
     return order;
   }
   
   // RIGHT - use asyncHandler or try-catch
   const getOrder = asyncHandler(async (req, res) => {
     const order = await OrderRepository.findById(id);
     res.json(order);
   });
   ```

3. **SQL Injection**
   ```javascript
   // WRONG - vulnerable to SQL injection!
   const query = `SELECT * FROM orders WHERE id = ${id}`;
   
   // RIGHT - use parameterized queries
   const query = `SELECT * FROM orders WHERE id = $1`;
   const result = await pool.query(query, [id]);
   ```

4. **Not using transactions**
   ```javascript
   // WRONG - if second query fails, first one is already saved!
   await OrderRepository.create(order);
   await InventoryRepository.reserveStock(sku);
   
   // RIGHT - use transaction
   const client = await beginTransaction();
   try {
     await OrderRepository.create(order, client);
     await InventoryRepository.reserveStock(sku, client);
     await commitTransaction(client);
   } catch (error) {
     await rollbackTransaction(client);
     throw error;
   }
   ```

---

## 📞 Getting Help

Stuck? Here's what to do:

1. **Check logs**: `backend/logs/error.log`
2. **Read error message**: It tells you file and line number
3. **Look up the file**: Use the tables above
4. **Read the code**: Start from the error line
5. **Trace backwards**: Follow the function calls
6. **Check database**: Is data there?
7. **Check request**: Is it sending correct data?
8. **Ask for help**: Include error message, logs, and what you tried

---

## 🎉 You're Ready!

You now have a complete reference for the entire backend. Save this file, refer to it often, and happy coding! 🚀

**Remember**: Every expert was once a beginner. Take it one file at a time!
