# Logistics Control Tower - Backend Implementation Roadmap

**Project:** SCM (Supply Chain Management) - Logistics Control Tower  
**Frontend:** React + TypeScript (Already Built)  
**Backend:** Node.js + Express + PostgreSQL + Redis  
**Approach:** Module-by-Module, Page-by-Page Integration

---

## 📊 Frontend Analysis SummaryMini Project()
A Logistics Control Tower is a real enterprise system (used by Amazon, Flipkart, 
DHL, Maersk-type orgs). Below is a clean, BIGMODULE decomposition the way 
architects document it. This is exactly how you should present it in reviews & 
interviews.
🚚
Logistics Control Tower
Order → Shipment → Returns + SLA Predictor
󾠮
User & Access Management Module
Purpose: Security + role-based access (enterprise mandatory)
Sub-modules
User authentication JWT / OAuth)
Role-based access control RBAC
Admin
Operations Manager
Warehouse Manager
Carrier Partner
Finance/Accounts
Customer Support
Organization / tenant management (multi-company support)
Activity & audit logs (who changed what & when)
󾠯
Master Data Management (MDM)
Purpose: Single source of truth for logistics entities
1
Mini Project()
Sub-modules
Warehouse master
Carrier master DHL, Delhivery, BlueDart – mock)
Route & lane master (origin → destination)
Product & SKU master
SLA policy master (by region, carrier, service type)
Cost & rate card master
👉
Why important: All calculations depend on accurate master data.
󾠰
Order Management System (OMS)
Purpose: Entry point of logistics lifecycle
Sub-modules
Order creation API / UI
Order validation
Order split engine (multi-item, multi-warehouse)
Priority tagging (express, standard, bulk)
Order status lifecycle
Created  Confirmed  Allocated  Shipped  Delivered / Returned
󾠱
Inventory & Warehouse Management (WMS-lite)
Purpose: Real-time stock visibility & allocation
Sub-modules
Multi-warehouse inventory tracking
Stock reservation & release
Allocation rules engine
Nearest warehouse
2
Mini Project()
Least-cost warehouse
SLA-first allocation
Pick–Pack–Ship workflow
Stock adjustment (damage, shrinkage)
📌
Interview keyword: Allocation strategy & inventory consistency
󾠲
Shipment & Carrier Integration Module
Purpose: Physical movement tracking
Sub-modules
Shipment creation & labeling
Carrier selection engine
Mock carrier APIs (pickup, transit, delivery)
Shipment event ingestion
Picked up
In transit
Out for delivery
Delivered
Real-time shipment timeline UI
󾠳
SLA Management & Compliance Engine
Purpose: Measure promises vs reality (core differentiator)
Sub-modules
SLA definition T1, T2, region-based)
SLA start/stop triggers
Promised vs actual delivery tracking
Breach detection
3
Mini Project()
Penalty calculation (carrier/vendor)
SLA dashboards & reports
🎯
This module alone makes the project “enterprise-gradeˮ.
󾠴
ETA Prediction & Delay Risk Engine (Advanced)
Purpose: Predict future delays before they happen
Sub-modules
Historical shipment data processing
Feature extraction
Distance
Carrier reliability
Warehouse load
Weather / holiday flag (mock)
ETA prediction model (basic ML or rules)
Delay risk scoring Low / Medium / High)
Proactive alerts
📌
 Can be rule-based first, ML later (very acceptable academically).
󾠵
Exception & Incident Management Module
Purpose: Handle real-world chaos
Sub-modules
Delay exception
Damage exception
Lost shipment exception
Auto-ticket generation
Resolution workflows
4
Mini Project()
Re-ship
Refund
Escalate to carrier
SLA impact recalculation
Root cause tagging
💡
Looks amazing in demos & viva.
󾠶
Returns & Reverse Logistics (RMA)
Purpose: Reverse flow (often ignored by students)
Sub-modules
Return request initiation
RMA generation
Pickup scheduling
Return shipment tracking
Quality check at warehouse
Refund / replacement triggers
Return SLA tracking
📌
 Interviewers LOVE reverse logistics coverage.
🔟
Route Optimization & Capacity Planning (Advanced)
Purpose: Cost & efficiency optimization
Sub-modules
Route distance calculation
Vehicle capacity constraints
Load consolidation
Cost comparison between routes
5
Mini Project()
Warehouse throughput dashboard
Peak load prediction (basic)
󾠮󾠮
 Financials & Settlements Module
Purpose: Money flow behind logistics
Sub-modules
Shipment cost calculation
Carrier invoice validation
Penalty adjustments SLA breach)
Refund accounting
Profitability per order / route
Finance reports
󾠮󾠯
 Analytics & Control Tower Dashboard
Purpose: “Single screen of truthˮ
Sub-modules
Live shipment map (mock GPS
SLA breach heatmaps
Carrier performance scorecards
Warehouse utilization charts
Exception trends
Predictive delay dashboard
📊
This is the “wow screenˮ for demos.
󾠮󾠰
 Notifications & Communication Module
Purpose: Real-time communication
6
Mini Project()
Sub-modules
Email/SMS/WhatsApp (mock)
Delay alerts
Delivery confirmation
Refund notifications
Internal escalation alerts
󾠮󾠱
 Admin & Configuration Module
Purpose: System control
Sub-modules
Rule configuration (allocation, SLA
Feature toggles
Threshold management
Data retention policies
System health monitoring
🧠
Big-Module Architecture View (Viva
ready)
Orders  Inventory  Shipment  Tracking
↓
SLA Engine & ETA Predictor
↓
Exceptions / Returns / Finance
↓
Control Tower Dashboard
7
Mini Project()
�
�
Recommended Tech Stack
(Modern • Scalable • Interview-Friendly)
󾠮
Frontend (Control Tower UI)
✅
React + TypeScript
Why
Industry standard for dashboards
Strong typing (important for complex logistics states)
Used in GCCs, e-commerce, SaaS companies
Libraries
React Query / TanStack Query  API state management
Tailwind CSS → clean enterprise UI
Recharts / Chart.js  SLA & performance graphs
Mapbox / Leaflet → live shipment map
Formik  Yup → complex forms (orders, returns)
📌
Optional upgrade: Next.js SSR for reports)
󾠯
Backend (Core Business Logic)
✅
Node.js + NestJS (Preferred)
OR
✅
Node.js + Express (Simpler)
Why NestJS is better
Modular architecture (perfect for big systems)
Dependency Injection
Cleaner separation of OMS, WMS, SLA, ETA modules
8
Mini Project()
Looks very “enterpriseˮ
Key Backend Responsibilities
Order lifecycle management
Inventory allocation logic
SLA & penalty calculations
Exception workflows
ETA prediction service
RBAC enforcement
󾠰
Database Layer (Most Important)
✅
PostgreSQL (Primary DB)
Why
Strong relational modeling (orders, shipments, SLA
Transactions (financials, inventory consistency)
Widely used in logistics & fintech
Core Tables
orders, order_items
warehouses, inventory
shipments, shipment_events
sla_policies, sla_violations
returns, refunds
carriers, rate_cards
users, roles, permissions
✅
Redis
Used for
9
Mini Project()
Caching frequently accessed data
Real-time shipment status
SLA timers
Background jobs BullMQ
󾠱
Messaging & Background Jobs
✅
BullMQ + Redis
Why
ETA prediction jobs
SLA breach checks
Notifications
Carrier sync jobs
📌
Enterprise alternative: RabbitMQ / Kafka (mention in viva)
󾠲
Carrier Integration (Mock APIs)
✅
REST-based Mock Carrier Services
Pickup scheduling API
Shipment tracking API
Delivery confirmation API
Failure simulation (delay, damage)
📌
 Shows real-world integration skills
󾠳
ETA Prediction & Risk Scoring
Option A (Safe & Accepted)
Rule-based engine (distance + carrier reliability + backlog)
10
Mini Project()
Option B (Advanced)
Python microservice
Scikit-learn
XGBoost / RandomForest
Communicate via REST / message queue
📌
 In interviews say:
“Started rule-based, migrated to ML-ready architecture.ˮ
󾠴
Authentication & Authorization
✅
JWT + Refresh Tokens
Access token for APIs
Refresh token for session continuity
✅
RBAC
Admin
Ops Manager
Warehouse
Carrier
Finance
📌
Advanced: Attribute-Based Access Control ABAC
󾠵
Notifications & Communication
✅
Node Mailer / Twilio (Mock)
Shipment updates
Delay alerts
11
Mini Project()
SLA breach alerts
Refund confirmation
📌
 Use async jobs BullMQ
󾠶
Analytics & Observability
✅
OpenTelemetry (basic)
API latency
Error rates
✅
ELK / OpenSearch (Optional)
Shipment logs
Exception logs
📊
 Dashboards:
SLA breach %
Carrier performance
Warehouse utilization
🔟
DevOps & Deployment
✅
Docker
Backend
Frontend
DB
✅
CI/CD
GitHub Actions
Lint + test + build
12
Mini Project()
✅
Deployment
Backend  AWS EC2 / Railway / Render
DB  AWS RDS Postgres)
Frontend  Vercel / Netlify
󾠮󾠮
 API Design Style
✅
REST APIs
Clean & interview-friendly
📌
 Example:
POST   /orders
GET    /shipments/{id}/timeline
POST   /returns
GET    /sla/violations
POST   /exceptions/{id}/resolve
󾠮󾠯
 Optional Enterprise Upgrades (Mention in Viva)
Area
Upgrade
Messaging
Auth
Infra
Search
Maps
Kafka
Keycloak
Kubernetes
ElasticSearch
Google Maps API
Streaming
WebSockets
13
Mini Project()

### **Existing Pages (11 Total)**
1. **Dashboard** - Control tower view with metrics, charts, maps
2. **Orders** - Order management with filters, details modal
3. **Shipments** - Shipment tracking with timeline
4. **Inventory** - Warehouse stock management
5. **Returns** - Reverse logistics handling
6. **Exceptions** - Incident management
7. **Analytics** - Performance reports & charts
8. **Carriers** - Carrier partner management
9. **Warehouses** - Warehouse master data
10. **Settings** - System configuration
11. **Login** - Authentication page

### **Frontend Expectations**
- JWT-based auth with refresh tokens
- RESTful API endpoints at `http://localhost:3001/api`
- Type-safe interfaces defined in `types/index.ts`
- Axios client with interceptors in `api/client.ts`
- Zustand stores for state management
- Mock data already structured

---

## 🎯 Implementation Strategy

### **Phase Order (Critical Path)**
1. **Foundation First**: Database → Auth → MDM
2. **Core Flow**: Orders → Inventory → Shipments → Tracking
3. **Intelligence**: SLA Engine → ETA Predictor → Exceptions
4. **Advanced**: Returns → Analytics → Notifications
5. **Polish**: Admin Config → Performance Optimization

### **Incremental Approach**
- Build one module completely (DB → API → Frontend integration → Test)
- Use mock data initially, replace with real logic progressively
- Commit after each working module
- Test with frontend after every module completion

---

## 🗄️ Phase 0: Database Foundation (Day 1-2)

### **Step 0.1: Database Schema Design**
```sql
-- Create these tables in order (dependencies matter)

-- 1. Organizations & Users
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'operations_manager', 'warehouse_manager', 'carrier_partner', 'finance', 'customer_support')),
  organization_id UUID REFERENCES organizations(id),
  avatar VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  changes JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Master Data Management (MDM)
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address JSONB NOT NULL, -- {street, city, state, postal_code, country, coordinates}
  capacity INTEGER,
  manager_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  service_type VARCHAR(50), -- express, standard, bulk
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  reliability_score DECIMAL(3,2) DEFAULT 0.85,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id UUID REFERENCES carriers(id),
  origin_state VARCHAR(100),
  destination_state VARCHAR(100),
  service_type VARCHAR(50),
  base_rate DECIMAL(10,2),
  per_kg_rate DECIMAL(10,2),
  fuel_surcharge_pct DECIMAL(5,2),
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  weight DECIMAL(10,2), -- in kg
  dimensions JSONB, -- {length, width, height}
  unit_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  service_type VARCHAR(50), -- express, standard, bulk
  origin_region VARCHAR(100),
  destination_region VARCHAR(100),
  delivery_hours INTEGER NOT NULL, -- e.g., 24, 48, 72
  penalty_per_hour DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Inventory & Stock
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id),
  product_id UUID REFERENCES products(id),
  available_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  damaged_quantity INTEGER DEFAULT 0,
  last_stock_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id)
);

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id),
  product_id UUID REFERENCES products(id),
  movement_type VARCHAR(50), -- inbound, outbound, transfer, adjustment
  quantity INTEGER NOT NULL,
  reference_type VARCHAR(50), -- order, return, adjustment
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'created', -- created, confirmed, allocated, shipped, delivered, returned, cancelled
  priority VARCHAR(20) DEFAULT 'standard', -- express, standard, bulk
  total_amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  estimated_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  sku VARCHAR(100),
  product_name VARCHAR(255),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  weight DECIMAL(10,2),
  warehouse_id UUID REFERENCES warehouses(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Shipments & Tracking
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number VARCHAR(100) UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id),
  carrier_id UUID REFERENCES carriers(id),
  warehouse_id UUID REFERENCES warehouses(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, picked_up, in_transit, at_hub, out_for_delivery, delivered, failed_delivery, returned
  origin_address JSONB,
  destination_address JSONB,
  weight DECIMAL(10,2),
  dimensions JSONB,
  shipping_cost DECIMAL(10,2),
  pickup_scheduled TIMESTAMPTZ,
  pickup_actual TIMESTAMPTZ,
  delivery_scheduled TIMESTAMPTZ,
  delivery_actual TIMESTAMPTZ,
  current_location JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- picked_up, in_transit, at_hub, out_for_delivery, delivered, exception
  location JSONB,
  description TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SLA & Compliance
CREATE TABLE sla_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id),
  sla_policy_id UUID REFERENCES sla_policies(id),
  promised_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,
  delay_hours DECIMAL(10,2),
  penalty_amount DECIMAL(10,2),
  reason VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open', -- open, acknowledged, resolved, waived
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Returns & Reverse Logistics
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_number VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id),
  shipment_id UUID REFERENCES shipments(id),
  reason VARCHAR(255),
  status VARCHAR(50) DEFAULT 'requested', -- requested, approved, pickup_scheduled, in_transit, received, inspected, refunded, rejected
  return_shipment_id UUID REFERENCES shipments(id),
  quality_check_result VARCHAR(50), -- passed, failed, damaged
  refund_amount DECIMAL(10,2),
  restocking_fee DECIMAL(10,2),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  reason_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Exceptions & Incidents
CREATE TABLE exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_type VARCHAR(50), -- delay, damage, lost_shipment, address_issue, carrier_issue
  severity VARCHAR(20), -- low, medium, high, critical
  shipment_id UUID REFERENCES shipments(id),
  order_id UUID REFERENCES orders(id),
  description TEXT,
  status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved, escalated
  assigned_to UUID REFERENCES users(id),
  resolution VARCHAR(50), -- reship, refund, escalate, none
  resolution_notes TEXT,
  sla_impacted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 9. ETA Predictions & Risk Scoring
CREATE TABLE eta_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id),
  predicted_delivery TIMESTAMPTZ,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  delay_risk_score VARCHAR(20), -- low, medium, high
  factors JSONB, -- {distance, carrier_reliability, warehouse_load, weather, etc}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50), -- order_update, shipment_update, sla_breach, exception_alert, return_update
  title VARCHAR(255),
  message TEXT,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Financials
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  carrier_id UUID REFERENCES carriers(id),
  billing_period_start DATE,
  billing_period_end DATE,
  total_shipments INTEGER,
  base_amount DECIMAL(10,2),
  penalties DECIMAL(10,2),
  adjustments DECIMAL(10,2),
  final_amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, paid, disputed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_carrier ON shipments(carrier_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_sla_violations_status ON sla_violations(status);
CREATE INDEX idx_exceptions_status ON exceptions(status);
```

### **Step 0.2: Database Setup File**
Create `backend/configs/db.js`:
```javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'logistics_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default pool;
```

### **Step 0.3: Seed Data Script**
Create `backend/scripts/seed.js` for initial data:
```javascript
import pool from '../configs/db.js';

async function seed() {
  // Create sample organization
  const orgResult = await pool.query(
    `INSERT INTO organizations (name, code) VALUES ($1, $2) RETURNING id`,
    ['Demo Logistics Inc', 'DEMO001']
  );
  
  // Create sample warehouses, carriers, products, SLA policies
  // ... (detailed seed data)
}

seed();
```

---

## 🔐 Module 1: User & Access Management (Day 3-4)

### **Frontend Pages Using This:**
- LoginPage
- Settings (user management section)
- All pages (authentication check)

### **Step 1.1: JWT Utilities**
Create `backend/utils/jwt.js`:
```javascript
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-key';

export function generateAccessToken(userId, role) {
  return jwt.sign({ userId, role }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(userId) {
  return jwt.sign({ userId }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
}
```

### **Step 1.2: Auth Middleware**
Create `backend/middlewares/auth.js`:
```javascript
import { verifyAccessToken } from '../utils/jwt.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // { userId, role }
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

### **Step 1.3: Users Controller**
Update `backend/controllers/usersController.js`:
```javascript
import bcrypt from 'bcrypt';
import pool from '../configs/db.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';

export async function login(req, res) {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query(
      `SELECT u.*, array_agg(up.permission) as permissions 
       FROM users u 
       LEFT JOIN user_permissions up ON u.id = up.user_id 
       WHERE u.email = $1 AND u.is_active = true
       GROUP BY u.id`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    
    // Remove password from response
    delete user.password_hash;
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
        avatar: user.avatar,
        permissions: user.permissions || [],
        lastLogin: user.last_login,
        createdAt: user.created_at
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function refreshToken(req, res) {
  // Handle refresh token logic
}

export async function getProfile(req, res) {
  // Get current user profile
}

export async function updateProfile(req, res) {
  // Update user profile
}

export async function createUser(req, res) {
  // Admin: create new user
}

export async function listUsers(req, res) {
  // Admin: list all users with filters
}
```

### **Step 1.4: Users Routes**
Update `backend/routes/users.js`:
```javascript
import express from 'express';
import * as usersController from '../controllers/usersController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.post('/auth/login', usersController.login);
router.post('/auth/refresh', usersController.refreshToken);

// Protected routes
router.get('/users/me', authenticate, usersController.getProfile);
router.put('/users/me', authenticate, usersController.updateProfile);

// Admin only
router.post('/users', authenticate, authorize('admin'), usersController.createUser);
router.get('/users', authenticate, authorize('admin', 'operations_manager'), usersController.listUsers);

export default router;
```

### **Integration Test with Frontend:**
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev

# Test login at http://localhost:5173/login
```

---

## 📦 Module 2: Master Data Management (Day 5-6)

### **Frontend Pages Using This:**
- WarehousesPage
- CarriersPage
- Settings (MDM section)

### **Step 2.1: MDM Controller**
Update `backend/controllers/mdmController.js`:
```javascript
import pool from '../configs/db.js';

// WAREHOUSES
export async function listWarehouses(req, res) {
  const { is_active, search } = req.query;
  
  let query = 'SELECT * FROM warehouses WHERE 1=1';
  const params = [];
  
  if (is_active !== undefined) {
    params.push(is_active === 'true');
    query += ` AND is_active = $${params.length}`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length})`;
  }
  
  query += ' ORDER BY created_at DESC';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}

export async function getWarehouse(req, res) {
  const { id } = req.params;
  const result = await pool.query('SELECT * FROM warehouses WHERE id = $1', [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Warehouse not found' });
  }
  
  res.json(result.rows[0]);
}

export async function createWarehouse(req, res) {
  const { code, name, address, capacity, manager_id } = req.body;
  
  const result = await pool.query(
    `INSERT INTO warehouses (code, name, address, capacity, manager_id) 
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [code, name, JSON.stringify(address), capacity, manager_id]
  );
  
  res.status(201).json(result.rows[0]);
}

export async function updateWarehouse(req, res) {
  // Update warehouse logic
}

export async function deleteWarehouse(req, res) {
  // Soft delete warehouse
}

// CARRIERS
export async function listCarriers(req, res) {
  // Similar to warehouses
}

export async function createCarrier(req, res) {
  // Create carrier
}

// PRODUCTS
export async function listProducts(req, res) {
  // List products with filters
}

export async function createProduct(req, res) {
  // Create product
}

// SLA POLICIES
export async function listSlaPolicies(req, res) {
  // List SLA policies
}

export async function createSlaPolicy(req, res) {
  // Create SLA policy
}

// RATE CARDS
export async function listRateCards(req, res) {
  // List rate cards by carrier
}

export async function createRateCard(req, res) {
  // Create rate card
}
```

### **Step 2.2: MDM Routes**
Update `backend/routes/mdm.js`:
```javascript
import express from 'express';
import * as mdmController from '../controllers/mdmController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Warehouses
router.get('/warehouses', authenticate, mdmController.listWarehouses);
router.get('/warehouses/:id', authenticate, mdmController.getWarehouse);
router.post('/warehouses', authenticate, authorize('admin', 'operations_manager'), mdmController.createWarehouse);
router.put('/warehouses/:id', authenticate, authorize('admin', 'operations_manager'), mdmController.updateWarehouse);
router.delete('/warehouses/:id', authenticate, authorize('admin'), mdmController.deleteWarehouse);

// Carriers
router.get('/carriers', authenticate, mdmController.listCarriers);
router.post('/carriers', authenticate, authorize('admin'), mdmController.createCarrier);

// Products
router.get('/products', authenticate, mdmController.listProducts);
router.post('/products', authenticate, authorize('admin', 'operations_manager'), mdmController.createProduct);

// SLA Policies
router.get('/sla-policies', authenticate, mdmController.listSlaPolicies);
router.post('/sla-policies', authenticate, authorize('admin'), mdmController.createSlaPolicy);

// Rate Cards
router.get('/carriers/:carrierId/rate-cards', authenticate, mdmController.listRateCards);
router.post('/rate-cards', authenticate, authorize('admin', 'finance'), mdmController.createRateCard);

export default router;
```

---

## 📋 Module 3: Order Management System (Day 7-9)

### **Frontend Page:** OrdersPage

### **Step 3.1: Orders Controller**
Update `backend/controllers/ordersController.js`:
```javascript
import pool from '../configs/db.js';
import { v4 as uuidv4 } from 'uuid';

export async function listOrders(req, res) {
  const { status, priority, from_date, to_date, search, page = 1, limit = 20 } = req.query;
  
  let query = `
    SELECT o.*, 
           COUNT(*) OVER() as total_count,
           json_agg(json_build_object(
             'id', oi.id,
             'productId', oi.product_id,
             'sku', oi.sku,
             'productName', oi.product_name,
             'quantity', oi.quantity,
             'unitPrice', oi.unit_price,
             'weight', oi.weight,
             'warehouseId', oi.warehouse_id
           )) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (status) {
    params.push(status);
    query += ` AND o.status = $${params.length}`;
  }
  
  if (priority) {
    params.push(priority);
    query += ` AND o.priority = $${params.length}`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (o.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length})`;
  }
  
  query += ` GROUP BY o.id ORDER BY o.created_at DESC`;
  
  const offset = (page - 1) * limit;
  query += ` LIMIT ${limit} OFFSET ${offset}`;
  
  const result = await pool.query(query, params);
  
  res.json({
    orders: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: result.rows[0]?.total_count || 0
    }
  });
}

export async function getOrder(req, res) {
  const { id } = req.params;
  
  const result = await pool.query(
    `SELECT o.*, 
            json_agg(json_build_object(
              'id', oi.id,
              'productId', oi.product_id,
              'sku', oi.sku,
              'productName', oi.product_name,
              'quantity', oi.quantity,
              'unitPrice', oi.unit_price,
              'weight', oi.weight,
              'warehouseId', oi.warehouse_id
            )) as items
     FROM orders o
     LEFT JOIN order_items oi ON o.id = oi.order_id
     WHERE o.id = $1
     GROUP BY o.id`,
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  res.json(result.rows[0]);
}

export async function createOrder(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { customerName, customerEmail, customerPhone, priority, shippingAddress, items } = req.body;
    
    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Calculate total
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    
    // Insert order
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, 
                          priority, total_amount, shipping_address, billing_address, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [orderNumber, customerName, customerEmail, customerPhone, priority, totalAmount,
       JSON.stringify(shippingAddress), JSON.stringify(shippingAddress), 'created']
    );
    
    const order = orderResult.rows[0];
    
    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, sku, product_name, quantity, unit_price, weight)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.id, item.productId, item.sku, item.productName, item.quantity, item.unitPrice, item.weight]
      );
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(order);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status, notes } = req.body;
  
  const result = await pool.query(
    'UPDATE orders SET status = $1, notes = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [status, notes, id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  // Log audit
  await pool.query(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes) VALUES ($1, $2, $3, $4, $5)',
    [req.user.userId, 'update_order_status', 'order', id, JSON.stringify({ status, notes })]
  );
  
  res.json(result.rows[0]);
}

export async function cancelOrder(req, res) {
  // Cancel order and release inventory
}

export async function getOrderStatistics(req, res) {
  // Dashboard statistics for orders
}
```

---

## 📦 Module 4: Inventory & Warehouse Management (Day 10-12)

### **Frontend Page:** InventoryPage

### **Step 4.1: Inventory Controller**
Update `backend/controllers/inventoryController.js`:
```javascript
import pool from '../configs/db.js';

export async function listInventory(req, res) {
  const { warehouse_id, product_id, low_stock } = req.query;
  
  let query = `
    SELECT i.*, w.name as warehouse_name, w.code as warehouse_code,
           p.name as product_name, p.sku, p.category
    FROM inventory i
    JOIN warehouses w ON i.warehouse_id = w.id
    JOIN products p ON i.product_id = p.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (warehouse_id) {
    params.push(warehouse_id);
    query += ` AND i.warehouse_id = $${params.length}`;
  }
  
  if (low_stock === 'true') {
    query += ` AND i.available_quantity < 100`; // Threshold
  }
  
  query += ' ORDER BY i.updated_at DESC';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}

export async function allocateInventory(req, res) {
  const { orderId, items } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Allocation logic: Find nearest warehouse with stock
    for (const item of items) {
      const stockResult = await client.query(
        `SELECT id, warehouse_id, available_quantity 
         FROM inventory 
         WHERE product_id = $1 AND available_quantity >= $2
         ORDER BY available_quantity DESC
         LIMIT 1`,
        [item.productId, item.quantity]
      );
      
      if (stockResult.rows.length === 0) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
      
      const stock = stockResult.rows[0];
      
      // Reserve quantity
      await client.query(
        `UPDATE inventory 
         SET available_quantity = available_quantity - $1,
             reserved_quantity = reserved_quantity + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [item.quantity, stock.id]
      );
      
      // Update order item with warehouse
      await client.query(
        'UPDATE order_items SET warehouse_id = $1 WHERE order_id = $2 AND product_id = $3',
        [stock.warehouse_id, orderId, item.productId]
      );
      
      // Log stock movement
      await client.query(
        `INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [stock.warehouse_id, item.productId, 'outbound', -item.quantity, 'order', orderId]
      );
    }
    
    // Update order status
    await client.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      ['allocated', orderId]
    );
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Inventory allocated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Allocation error:', error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
}

export async function adjustStock(req, res) {
  // Manual stock adjustment (damage, shrinkage, etc.)
}

export async function getStockMovements(req, res) {
  // History of stock movements
}
```

---

## 🚚 Module 5: Shipment & Carrier Integration (Day 13-15)

### **Frontend Page:** ShipmentsPage

### **Step 5.1: Mock Carrier Service**
Create `backend/services/carrierService.js`:
```javascript
import axios from 'axios';

// Mock carrier API responses
export async function schedulePickup(carrierId, shipmentDetails) {
  // Simulate API call to carrier
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    pickupId: `PU-${Date.now()}`,
    status: 'scheduled',
    scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
}

export async function getTrackingUpdates(trackingNumber) {
  // Mock tracking events
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return [
    { status: 'picked_up', timestamp: new Date(), location: 'Origin Hub' },
    { status: 'in_transit', timestamp: new Date(), location: 'Transit Center' }
  ];
}

export async function cancelShipment(trackingNumber) {
  // Cancel with carrier
  return { success: true };
}
```

### **Step 5.2: Shipments Controller**
Update `backend/controllers/shipmentsController.js`:
```javascript
import pool from '../configs/db.js';
import * as carrierService from '../services/carrierService.js';

export async function createShipment(req, res) {
  const { orderId } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get order details
    const orderResult = await client.query(
      `SELECT o.*, array_agg(row_to_json(oi.*)) as items
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1 AND o.status = 'allocated'
       GROUP BY o.id`,
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      throw new Error('Order not found or not allocated');
    }
    
    const order = orderResult.rows[0];
    
    // Select carrier (simple logic: first active carrier)
    const carrierResult = await client.query(
      'SELECT * FROM carriers WHERE is_active = true ORDER BY reliability_score DESC LIMIT 1'
    );
    
    const carrier = carrierResult.rows[0];
    const trackingNumber = `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Calculate weight
    const totalWeight = order.items.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
    
    // Get warehouse
    const warehouseId = order.items[0].warehouse_id;
    
    // Create shipment
    const shipmentResult = await client.query(
      `INSERT INTO shipments (tracking_number, order_id, carrier_id, warehouse_id, 
                             destination_address, weight, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [trackingNumber, orderId, carrier.id, warehouseId, order.shipping_address, totalWeight, 'pending']
    );
    
    const shipment = shipmentResult.rows[0];
    
    // Schedule pickup with carrier
    const pickupResult = await carrierService.schedulePickup(carrier.id, shipment);
    
    await client.query(
      'UPDATE shipments SET pickup_scheduled = $1 WHERE id = $2',
      [pickupResult.scheduledTime, shipment.id]
    );
    
    // Update order status
    await client.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
      ['shipped', orderId]
    );
    
    // Create initial event
    await client.query(
      `INSERT INTO shipment_events (shipment_id, event_type, description, event_timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [shipment.id, 'created', 'Shipment created and pickup scheduled']
    );
    
    await client.query('COMMIT');
    res.status(201).json(shipment);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create shipment error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}

export async function listShipments(req, res) {
  const { status, carrier_id, from_date, to_date } = req.query;
  
  let query = `
    SELECT s.*, c.name as carrier_name, o.order_number
    FROM shipments s
    JOIN carriers c ON s.carrier_id = c.id
    JOIN orders o ON s.order_id = o.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (status) {
    params.push(status);
    query += ` AND s.status = $${params.length}`;
  }
  
  query += ' ORDER BY s.created_at DESC';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}

export async function getShipmentTimeline(req, res) {
  const { id } = req.params;
  
  const result = await pool.query(
    `SELECT se.*, s.tracking_number
     FROM shipment_events se
     JOIN shipments s ON se.shipment_id = s.id
     WHERE se.shipment_id = $1
     ORDER BY se.event_timestamp ASC`,
    [id]
  );
  
  res.json(result.rows);
}

export async function updateShipmentStatus(req, res) {
  const { id } = req.params;
  const { status, location, description } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update shipment
    await client.query(
      `UPDATE shipments SET status = $1, current_location = $2, updated_at = NOW() WHERE id = $3`,
      [status, JSON.stringify(location), id]
    );
    
    // Add event
    await client.query(
      `INSERT INTO shipment_events (shipment_id, event_type, location, description, event_timestamp)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, status, JSON.stringify(location), description]
    );
    
    // If delivered, update order
    if (status === 'delivered') {
      await client.query(
        `UPDATE orders SET status = 'delivered', actual_delivery = NOW() 
         WHERE id = (SELECT order_id FROM shipments WHERE id = $1)`,
        [id]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update shipment' });
  } finally {
    client.release();
  }
}
```

---

## ⏱️ Module 6: SLA Management & Compliance (Day 16-17)

### **Frontend Pages:** Dashboard (SLA metrics), Analytics, ShipmentsPage (SLA status)

### **Step 6.1: SLA Controller**
Update `backend/controllers/slaController.js`:
```javascript
import pool from '../configs/db.js';

export async function checkSlaCompliance(shipmentId) {
  // Get shipment and applicable SLA policy
  const result = await pool.query(
    `SELECT s.*, o.priority, o.estimated_delivery, o.actual_delivery,
            sp.delivery_hours, sp.penalty_per_hour
     FROM shipments s
     JOIN orders o ON s.order_id = o.id
     LEFT JOIN sla_policies sp ON sp.service_type = o.priority
     WHERE s.id = $1`,
    [shipmentId]
  );
  
  if (result.rows.length === 0) return null;
  
  const shipment = result.rows[0];
  
  if (!shipment.actual_delivery || !shipment.estimated_delivery) return null;
  
  const promisedTime = new Date(shipment.estimated_delivery);
  const actualTime = new Date(shipment.actual_delivery);
  
  if (actualTime > promisedTime) {
    const delayHours = (actualTime - promisedTime) / (1000 * 60 * 60);
    const penalty = delayHours * (shipment.penalty_per_hour || 0);
    
    // Record violation
    await pool.query(
      `INSERT INTO sla_violations (shipment_id, sla_policy_id, promised_delivery, 
                                   actual_delivery, delay_hours, penalty_amount, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [shipmentId, shipment.sla_policy_id, promisedTime, actualTime, delayHours, penalty, 'Delayed delivery']
    );
    
    return { breached: true, delayHours, penalty };
  }
  
  return { breached: false };
}

export async function listViolations(req, res) {
  const { status, from_date, to_date, carrier_id } = req.query;
  
  let query = `
    SELECT sv.*, s.tracking_number, c.name as carrier_name, o.order_number
    FROM sla_violations sv
    JOIN shipments s ON sv.shipment_id = s.id
    JOIN carriers c ON s.carrier_id = c.id
    JOIN orders o ON s.order_id = o.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (status) {
    params.push(status);
    query += ` AND sv.status = $${params.length}`;
  }
  
  query += ' ORDER BY sv.created_at DESC';
  
  const result = await pool.query(query, params);
  res.json(result.rows);
}

export async function getSlaDashboard(req, res) {
  // Aggregate SLA metrics
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE delay_hours > 0) as total_breaches,
      COUNT(*) FILTER (WHERE status = 'open') as open_breaches,
      SUM(penalty_amount) as total_penalties,
      AVG(delay_hours) as avg_delay_hours
    FROM sla_violations
    WHERE created_at >= NOW() - INTERVAL '30 days'
  `);
  
  res.json(result.rows[0]);
}
```

---

## 🎯 Module 7: ETA Prediction & Delay Risk (Day 18-19)

### **Frontend Pages:** Dashboard, ShipmentsPage (ETA display)

### **Step 7.1: ETA Service (Rule-Based)**
Create `backend/services/etaService.js`:
```javascript
import pool from '../configs/db.js';

export async function predictETA(shipmentId) {
  const result = await pool.query(
    `SELECT s.*, c.reliability_score, w.address as origin_address,
            o.shipping_address as dest_address, o.priority
     FROM shipments s
     JOIN carriers c ON s.carrier_id = c.id
     JOIN warehouses w ON s.warehouse_id = w.id
     JOIN orders o ON s.order_id = o.id
     WHERE s.id = $1`,
    [shipmentId]
  );
  
  if (result.rows.length === 0) return null;
  
  const shipment = result.rows[0];
  
  // Rule-based calculation
  const baseHours = shipment.priority === 'express' ? 24 : (shipment.priority === 'standard' ? 72 : 120);
  const reliabilityFactor = shipment.reliability_score || 0.85;
  const bufferHours = baseHours * (1 - reliabilityFactor) * 0.5;
  
  const estimatedHours = baseHours + bufferHours;
  const predictedDelivery = new Date(Date.now() + estimatedHours * 60 * 60 * 1000);
  
  // Calculate delay risk
  let delayRisk = 'low';
  if (reliabilityScore < 0.7) delayRisk = 'high';
  else if (reliabilityScore < 0.85) delayRisk = 'medium';
  
  // Store prediction
  await pool.query(
    `INSERT INTO eta_predictions (shipment_id, predicted_delivery, confidence_score, delay_risk_score, factors)
     VALUES ($1, $2, $3, $4, $5)`,
    [shipmentId, predictedDelivery, reliabilityFactor, delayRisk, JSON.stringify({ baseHours, bufferHours })]
  );
  
  return { predictedDelivery, delayRisk, confidence: reliabilityFactor };
}
```

---

## 🚨 Module 8: Exception Management (Day 20-21)

### **Frontend Page:** ExceptionsPage

### **Step 8.1: Exceptions Controller**
Create complete exception handling with auto-ticket generation and resolution workflows similar to previous modules.

---

## 🔄 Module 9: Returns & Reverse Logistics (Day 22-23)

### **Frontend Page:** ReturnsPage

Implement returns controller with RMA generation, quality checks, and refund processing.

---

## 📊 Module 10: Analytics & Dashboard APIs (Day 24-25)

### **Frontend Pages:** Dashboard, AnalyticsPage

Implement aggregation queries for:
- Real-time metrics (orders, shipments, SLA breaches)
- Time-series data for charts
- Carrier performance scorecards
- Warehouse utilization
- Financial summaries

---

## 🔔 Module 11: Notifications (Day 26)

Implement BullMQ jobs for email/SMS notifications on order updates, delays, SLA breaches.

---

## 💰 Module 12: Financials & Settlements (Day 27)

Invoice generation, penalty calculations, settlement reports.

---

## ⚙️ Module 13: Admin Configuration (Day 28)

System settings, rule configuration, feature toggles.

---

## 🔧 Module 14: Background Jobs & Optimization (Day 29-30)

Setup BullMQ for:
- Periodic SLA checks
- ETA recalculations
- Stock level alerts
- Report generation

---

## ✅ Final Integration Checklist

1. ✓ All API endpoints return correct TypeScript types
2. ✓ JWT auth working across all routes
3. ✓ Database transactions for critical operations
4. ✓ Error handling and logging
5. ✓ CORS configured properly
6. ✓ Rate limiting on auth endpoints
7. ✓ Docker compose for local development
8. ✓ Environment variables documented
9. ✓ Seed data for demo
10. ✓ API documentation (Postman/Swagger)

---

## 🚀 Deployment Preparation

1. Database: AWS RDS PostgreSQL
2. Backend: Railway/Render
3. Redis: Redis Cloud
4. Frontend: Vercel
5. Monitoring: Setup logging with Pino

---

**End of Roadmap** | Total Estimated Time: 30 Days | Module-by-Module Integration Complete
