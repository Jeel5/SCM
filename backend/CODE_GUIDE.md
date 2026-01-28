# 🎓 TwinChain Backend Code Guide for Beginners

Welcome! This guide explains the entire backend codebase in simple terms, so anyone with zero programming knowledge can understand how it works.

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [How HTTP Requests Work](#how-http-requests-work)
3. [Project Structure](#project-structure)
4. [Key Concepts](#key-concepts)
5. [File-by-File Explanation](#file-by-file-explanation)
6. [Common Patterns](#common-patterns)
7. [Glossary](#glossary)

---

## 🌟 Overview

### What is this system?
This is a **Supply Chain Management System** (like Amazon's order tracking, but for businesses). It helps companies:
- Track orders from customers
- Manage warehouse inventory
- Track shipments in real-time
- Handle returns and refunds
- Monitor performance with analytics

### Technology Stack (Tools We Use)
- **Node.js**: JavaScript runtime that lets us run JavaScript on servers (not just browsers)
- **Express.js**: Framework that makes building web APIs super easy
- **PostgreSQL**: Database where we store all data (orders, users, inventory)
- **JWT**: Security tokens for authentication (like a digital ID card)
- **Winston**: Logging system that writes events to files
- **bcrypt**: Password encryption (stores passwords safely)

---

## 🔄 How HTTP Requests Work

Think of HTTP requests like **ordering food at a restaurant**:

1. **Customer (Frontend)** → Places order → **Kitchen (Backend)**
2. **Kitchen** → Prepares food → **Database** (gets ingredients)
3. **Kitchen** → Returns plate of food → **Customer**

### Example: User logs in

```
Frontend                Backend                    Database
   |                       |                          |
   |--POST /api/auth/login-->                        |
   |  {email, password}   |                          |
   |                      |--Query user by email---->|
   |                      |                          |
   |                      |<--Return user data-------|
   |                      |                          |
   |                      | (Check password)         |
   |<--200 OK-------------|                          |
   |  {token, user}       |                          |
```

### HTTP Status Codes (Response Types)
- **200**: Success! Everything worked
- **201**: Created! New resource was created
- **400**: Bad Request - You sent invalid data
- **401**: Unauthorized - You need to login
- **403**: Forbidden - You don't have permission
- **404**: Not Found - That doesn't exist
- **500**: Server Error - Something broke on our end

---

## 📁 Project Structure

```
backend/
│
├── server.js                    ← STARTS HERE! Main entry point
│
├── configs/
│   └── db.js                    ← Database connection setup
│
├── controllers/                 ← Handle HTTP requests
│   ├── ordersController.js      ← Orders: Create, list, update
│   ├── usersController.js       ← Users: Login, profile
│   ├── inventoryController.js   ← Inventory: Stock levels
│   └── ...
│
├── services/                    ← Business logic
│   └── orderService.js          ← Order processing logic
│
├── repositories/                ← Database queries
│   ├── BaseRepository.js        ← Common database operations
│   ├── OrderRepository.js       ← Order-specific queries
│   ├── InventoryRepository.js   ← Inventory queries
│   └── ...
│
├── middlewares/                 ← Request processors
│   ├── auth.js                  ← Check if user is logged in
│   ├── rbac.js                  ← Check user permissions (roles)
│   └── requestLogger.js         ← Log all requests
│
├── routes/                      ← URL definitions
│   ├── orders.js                ← /api/orders endpoints
│   ├── users.js                 ← /api/auth endpoints
│   └── ...
│
├── validators/                  ← Input validation
│   ├── index.js                 ← Validation framework
│   ├── orderSchemas.js          ← Order validation rules
│   └── ...
│
├── errors/                      ← Error handling
│   ├── AppError.js              ← Custom error classes
│   └── errorHandler.js          ← Global error handler
│
├── utils/                       ← Utility functions
│   ├── logger.js                ← Winston logging setup
│   └── jwt.js                   ← JWT token utilities
│
└── logs/                        ← Log files
    ├── error.log                ← Only errors
    ├── combined.log             ← All logs
    └── http.log                 ← HTTP requests
```

---

## 🧩 Key Concepts

### 1. **Layered Architecture**
Our code is organized in layers, like a cake:

```
┌─────────────────────────────────┐
│   Routes (URLs)                 │  ← "I handle /api/orders"
├─────────────────────────────────┤
│   Controllers (HTTP Logic)      │  ← "I receive requests, send responses"
├─────────────────────────────────┤
│   Services (Business Logic)     │  ← "I contain business rules"
├─────────────────────────────────┤
│   Repositories (Database)       │  ← "I talk to PostgreSQL"
└─────────────────────────────────┘
         ↕
    Database (PostgreSQL)
```

**Why layers?**
- **Separation of Concerns**: Each layer has ONE job
- **Testability**: Easy to test each layer independently
- **Maintainability**: Change one layer without breaking others
- **Scalability**: Easy to add new features

### 2. **Middleware Pipeline**
Every request passes through a series of functions before reaching the route handler:

```
Request → Middleware 1 → Middleware 2 → Middleware 3 → Route Handler → Response
          (Security)     (Logging)      (Auth Check)    (Your Code)
```

Example flow for `GET /api/orders`:
1. **helmet()** - Adds security headers
2. **cors()** - Checks if request is from allowed origin
3. **express.json()** - Parses JSON body
4. **requestId()** - Assigns unique ID to request
5. **requestLogger()** - Logs request details
6. **authenticate()** - Checks if user has valid JWT token
7. **authorize('orders:read')** - Checks if user has permission
8. **listOrders()** - Your actual route handler runs!

### 3. **Authentication vs Authorization**

**Authentication** (Who are you?)
- User sends username/password → We verify → Give them a token (JWT)
- Token is like a "key card" they show on future requests
- Handled by `middlewares/auth.js`

**Authorization** (What can you do?)
- User has a role (admin, warehouse, carrier, etc.)
- Each role has specific permissions
- Example: Warehouse staff can update inventory, but can't delete users
- Handled by `middlewares/rbac.js`

### 4. **Repository Pattern**
Instead of writing SQL queries everywhere, we centralize them in repositories:

**Without Repository (BAD):**
```javascript
// SQL scattered everywhere
const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
```

**With Repository (GOOD):**
```javascript
// Clean, reusable
const order = await OrderRepository.findById(id);
```

### 5. **Error Handling**
Errors are caught globally and formatted consistently:

```javascript
// Somewhere deep in code
throw new NotFoundError('Order');

// Global error handler catches it, sends:
{
  "error": "NotFoundError",
  "message": "Order not found",
  "statusCode": 404
}
```

---

## 📖 File-by-File Explanation

### 🚀 `server.js` - The Starting Point

**Purpose**: Main file that starts the entire application

**What it does**:
1. Imports all dependencies
2. Sets up middleware
3. Connects routes
4. Starts HTTP server on port 3001

**Key sections**:
- **Middleware setup**: Security, logging, parsing
- **Route registration**: Connects URLs to handlers
- **Error handlers**: Catches errors
- **Server start**: `app.listen()` makes it live

---

### 🗄️ `configs/db.js` - Database Connection

**Purpose**: Creates connection pool to PostgreSQL database

**What it does**:
- Reads database credentials from `.env` file
- Creates connection pool (manages multiple database connections)
- Tests connection on startup

**Connection Pool**: Think of it like a parking lot for database connections. Instead of opening a new connection for EVERY query (slow!), we keep 10-20 connections ready to use.

---

### 🎮 Controllers - HTTP Request Handlers

**Location**: `controllers/`

**Purpose**: Handle incoming HTTP requests, send responses

**Example**: `ordersController.js`

```javascript
// 1. Receive request
export async function listOrders(req, res) {
  // 2. Parse request data
  const { page, limit, status } = req.query;
  
  // 3. Call service layer (business logic)
  const result = await orderService.getOrders({ page, limit, status });
  
  // 4. Send response
  res.json(result);
}
```

**Key Points**:
- Controllers should be THIN - just handle HTTP stuff
- Business logic goes in services
- Database queries go in repositories

---

### 💼 Services - Business Logic

**Location**: `services/`

**Purpose**: Contains business rules and orchestrates operations

**Example**: `orderService.js`

```javascript
async createOrder(orderData) {
  // 1. Validate business rules
  if (!orderData.items || orderData.items.length === 0) {
    throw new BusinessLogicError('Order must have items');
  }
  
  // 2. Start database transaction
  const client = await OrderRepository.beginTransaction();
  
  try {
    // 3. Create order
    const order = await OrderRepository.createOrderWithItems(orderData, client);
    
    // 4. Reserve inventory
    for (const item of orderData.items) {
      await InventoryRepository.reserveStock(item.sku, item.quantity, client);
    }
    
    // 5. Commit transaction (save all changes)
    await OrderRepository.commitTransaction(client);
    
    // 6. Log event
    logEvent('OrderCreated', { orderId: order.id });
    
    return order;
  } catch (error) {
    // 7. Rollback on error (undo all changes)
    await OrderRepository.rollbackTransaction(client);
    throw error;
  }
}
```

**Key Concepts**:
- **Transactions**: Group of database operations that must ALL succeed or ALL fail
- **Business Logic**: Rules specific to your business (not just CRUD operations)
- **Orchestration**: Coordinating multiple repositories/operations

---

### 🗃️ Repositories - Database Access

**Location**: `repositories/`

**Purpose**: All SQL queries live here

**Example**: `OrderRepository.js`

```javascript
async findById(id, client = null) {
  // Parameterized query (prevents SQL injection!)
  const query = `
    SELECT * FROM orders 
    WHERE id = $1
  `;
  
  const result = await this.query(query, [id], client);
  return result.rows[0] || null;
}
```

**Base Repository**: Common CRUD operations all repos inherit:
- `findById(id)` - Get one record
- `findAll()` - Get all records
- `create(data)` - Insert new record
- `update(id, data)` - Update record
- `delete(id)` - Delete record

**Why repositories?**
- **DRY**: Don't repeat SQL queries
- **Security**: Parameterized queries prevent SQL injection
- **Testability**: Easy to mock database
- **Consistency**: All database code in one place

---

### 🛡️ Middlewares

**Location**: `middlewares/`

**Purpose**: Process requests before they reach route handlers

#### `auth.js` - Authentication

```javascript
// Checks if user has valid JWT token
export async function authenticate(req, res, next) {
  // 1. Get token from header
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // 2. Verify token
  const decoded = verifyAccessToken(token);
  
  // 3. Attach user to request
  req.user = decoded;
  
  // 4. Continue to next middleware
  next();
}
```

**How it works**:
- User logs in → Gets JWT token
- Future requests → User sends token in `Authorization` header
- Middleware verifies token → Attaches user info to `req.user`

#### `rbac.js` - Role-Based Access Control

```javascript
// Checks if user has required permission
export function authorize(permission) {
  return (req, res, next) => {
    const { role } = req.user;
    
    if (hasPermission(role, permission)) {
      next(); // Allow
    } else {
      throw new ForbiddenError(); // Deny
    }
  };
}
```

**Roles**:
- **Admin**: Can do everything
- **Operations**: Orders, shipments, exceptions
- **Warehouse**: Inventory, returns
- **Carrier**: Shipments (read + update tracking)
- **Finance**: Financial data, analytics

#### `requestLogger.js` - Request Logging

```javascript
// Logs every HTTP request
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req, res, duration);
  });
  
  next();
};
```

**Logs include**:
- URL requested
- HTTP method (GET, POST, etc.)
- Response status code (200, 404, 500)
- Response time in milliseconds
- IP address
- User agent (browser)

---

### 🛣️ Routes - URL Definitions

**Location**: `routes/`

**Purpose**: Define which URL calls which controller function

**Example**: `orders.js`

```javascript
const router = express.Router();

// GET /api/orders - List all orders
router.get('/orders', 
  authenticate,                    // Must be logged in
  authorize('orders:read'),        // Must have 'orders:read' permission
  validateQuery(listOrdersQuerySchema),  // Validate query params
  listOrders                       // Controller function
);

// POST /api/orders - Create new order
router.post('/orders',
  authenticate,
  authorize('orders:create'),
  validateRequest(createOrderSchema),
  createOrder
);
```

**Middleware stack** (runs in order):
1. `authenticate` - Check if user is logged in
2. `authorize` - Check if user has permission
3. `validateRequest/Query` - Check if data is valid
4. Controller function - Handle request

---

### ✅ Validators - Input Validation

**Location**: `validators/`

**Purpose**: Check if incoming data is valid BEFORE processing

**Example**: `orderSchemas.js`

```javascript
export const createOrderSchema = {
  customer_name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 255
  },
  customer_email: {
    type: 'string',
    required: true,
    email: true
  },
  total_amount: {
    type: 'number',
    required: true,
    min: 0.01
  },
  items: {
    type: 'array',
    required: true,
    minItems: 1
  }
};
```

**Why validate?**
- **Security**: Prevent malicious input
- **Data Quality**: Ensure data is correct
- **User Experience**: Give clear error messages
- **Database Integrity**: Don't insert bad data

---

### ❌ Errors - Error Handling

**Location**: `errors/`

**Purpose**: Standardize error responses

#### `AppError.js` - Custom Error Classes

```javascript
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}
```

**Error Types**:
- **ValidationError** (400) - Invalid input
- **AuthenticationError** (401) - Not logged in
- **ForbiddenError** (403) - No permission
- **NotFoundError** (404) - Doesn't exist
- **BusinessLogicError** (422) - Business rule violated
- **DatabaseError** (500) - Database problem

#### `errorHandler.js` - Global Error Handler

```javascript
export const errorHandler = (err, req, res, next) => {
  // Log error with context
  logError(err, {
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });
  
  // Send error response
  res.status(err.statusCode || 500).json({
    error: err.name,
    message: err.message
  });
};
```

---

### 🛠️ Utils - Helper Functions

**Location**: `utils/`

#### `logger.js` - Winston Logging

**Purpose**: Write logs to files for monitoring

```javascript
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

**Log Levels** (most to least important):
1. **error** - Something broke!
2. **warn** - Something unusual
3. **info** - Normal events
4. **http** - HTTP requests
5. **debug** - Detailed debugging info

#### `jwt.js` - JSON Web Token Utilities

**Purpose**: Create and verify authentication tokens

```javascript
// Create token when user logs in
export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Verify token on subsequent requests
export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
```

**JWT Structure**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIn0.xyz
│────────── Header ─────────────│────────── Payload ────────────│─ Signature ─│
```

---

## 🎯 Common Patterns

### Pattern 1: Create Resource

```javascript
// Route
router.post('/orders', authenticate, authorize('orders:create'), validateRequest(schema), createOrder);

// Controller
export async function createOrder(req, res) {
  const order = await orderService.createOrder(req.body);
  res.status(201).json({ success: true, data: order });
}

// Service
async createOrder(data) {
  const client = await OrderRepository.beginTransaction();
  try {
    const order = await OrderRepository.create(data, client);
    // ... more logic
    await OrderRepository.commitTransaction(client);
    return order;
  } catch (error) {
    await OrderRepository.rollbackTransaction(client);
    throw error;
  }
}

// Repository
async create(data, client) {
  const query = `INSERT INTO orders (...) VALUES (...) RETURNING *`;
  const result = await this.query(query, values, client);
  return result.rows[0];
}
```

### Pattern 2: List Resources with Pagination

```javascript
// Request: GET /api/orders?page=1&limit=20&status=pending

// Controller
export async function listOrders(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const result = await orderService.getOrders({ page, limit, status });
  res.json(result);
}

// Service
async getOrders({ page, limit, status }) {
  const { orders, totalCount } = await OrderRepository.findOrders({ page, limit, status });
  
  return {
    orders,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
}
```

### Pattern 3: Error Handling

```javascript
// Service
async getOrderById(id) {
  const order = await OrderRepository.findById(id);
  
  // If not found, throw error
  if (!order) {
    throw new NotFoundError('Order');
  }
  
  return order;
}

// Error is caught by global error handler
// Client receives:
{
  "error": "NotFoundError",
  "message": "Order not found",
  "statusCode": 404
}
```

---

## 📖 Glossary

**API** (Application Programming Interface)
- Set of URLs that let programs talk to each other
- Example: `/api/orders` to get orders

**Async/Await**
- Way to handle operations that take time (database queries, file reading)
- `await` = "wait for this to finish before continuing"

**Client**
- Database connection used for transactions
- Passed around so multiple operations use same connection

**Controller**
- Function that handles HTTP requests
- Receives request, sends response

**CRUD**
- Create, Read, Update, Delete
- Basic operations for any resource

**DTO** (Data Transfer Object)
- Object that carries data between layers
- Usually just plain JavaScript objects

**Environment Variables**
- Configuration stored in `.env` file
- Keeps secrets out of code

**Express**
- Web framework that makes building APIs easy
- Handles routing, middleware, etc.

**JWT** (JSON Web Token)
- Secure way to transmit user identity
- Used for authentication

**Middleware**
- Function that runs before route handler
- Can modify request, check authentication, log, etc.

**ORM** (Object-Relational Mapping)
- We DON'T use one! We write SQL directly in repositories

**Repository**
- Layer that handles all database operations
- Keeps SQL queries organized

**Route**
- URL pattern that maps to a controller
- Example: `GET /api/orders/:id`

**Service**
- Contains business logic
- Orchestrates repositories

**Transaction**
- Group of database operations that must all succeed or all fail
- Keeps data consistent

**Validation**
- Checking if data is correct before processing
- Example: email must be valid format

---

## 🎓 Learning Path

If you want to understand this codebase from scratch:

1. **Start with `server.js`** - See how everything connects
2. **Follow a single request** - Pick one route (like login) and trace it through all layers
3. **Read `routes/users.js`** - Simple authentication routes
4. **Read `controllers/usersController.js`** - See how login works
5. **Read `repositories/UserRepository.js`** - See database queries
6. **Read `middlewares/auth.js`** - Understand authentication
7. **Read `middlewares/rbac.js`** - Understand authorization
8. **Read `services/orderService.js`** - See complex business logic
9. **Read `errors/errorHandler.js`** - Understand error handling
10. **Read `utils/logger.js`** - See how logging works

---

## 🔍 Debugging Tips

**Check logs first!**
- `backend/logs/error.log` - All errors
- `backend/logs/combined.log` - Everything
- `backend/logs/http.log` - HTTP requests

**Common issues:**

1. **401 Unauthorized**
   - Check if JWT token is being sent
   - Check if token is valid (not expired)
   - Look in `middlewares/auth.js`

2. **403 Forbidden**
   - Check user's role
   - Check required permission
   - Look in `middlewares/rbac.js`

3. **404 Not Found**
   - Check route exists in `routes/` files
   - Check URL is correct
   - Look at `routes/` files

4. **500 Server Error**
   - Check `error.log` file
   - Usually database or logic error
   - Look at stack trace

**How to trace a request:**

1. Search logs for request ID (example: `req-abc123`)
2. Follow all log entries with that ID
3. See where it succeeded/failed

---

## 🤝 Contributing

When adding new features:

1. **Routes** - Define new URLs
2. **Controller** - Handle HTTP request/response
3. **Service** - Add business logic
4. **Repository** - Add database queries
5. **Validator** - Add validation schema
6. **Tests** - Write tests (future work)
7. **Documentation** - Update this guide!

---

## 📞 Support

Questions? Check:
- This guide
- `RBAC.md` for permissions
- `ARCHITECTURE.md` for design decisions
- Code comments in files
- Logs in `backend/logs/`

---

**Remember**: Code is just instructions for computers. Take it one step at a time, and you'll understand everything! 🚀
