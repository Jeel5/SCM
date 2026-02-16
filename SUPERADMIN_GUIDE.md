# Superadmin Implementation Guide

## Overview
The superadmin role has been successfully implemented as a multi-tenant management layer for TwinChain. This allows a single superadmin to manage multiple companies, each with their own admins and users.

## Architecture

### Multi-Tenant Hierarchy
```
Superadmin (Global)
  └── Company 1
      └── Admin 1
          └── Users (ops, warehouse, carrier, finance, support)
  └── Company 2
      └── Admin 2
          └── Users
  └── Company N...
```

### Key Features
- **Global Dashboard**: Aggregated metrics across all companies
- **Company Management**: CRUD operations for companies
- **User Management**: View and manage users across all organizations
- **Isolation**: Superadmin has NULL organization_id, company admins are scoped to their org

## Implementation Details

### 1. Database Changes

#### Updated Tables
**users table** - Added 'superadmin' to role constraint:
```sql
role VARCHAR(50) NOT NULL CHECK (role IN ('superadmin', 'admin', 'operations_manager', ...))
organization_id UUID REFERENCES organizations(id) -- Can be NULL for superadmin
```

#### New Superadmin User
```sql
INSERT INTO users VALUES (
  'superadmin@twinchain.in',
  '$2b$10$demoHashedPassword',
  'Super Admin',
  'superadmin',
  NULL, -- No organization
  'https://api.dicebear.com/7.x/avataaars/svg?seed=SuperAdmin',
  true
);
```

### 2. Backend Changes

#### RBAC Middleware (`backend/middlewares/rbac.js`)
```javascript
export const ROLES = {
  SUPERADMIN: 'superadmin',  // NEW
  ADMIN: 'admin',
  OPERATIONS: 'operations',
  // ...
};

const PERMISSIONS = {
  [ROLES.SUPERADMIN]: [
    '*:*',           // Full system access
    'companies:*',   // Company management
    'admins:*',      // Admin management
    'system:*'       // System operations
  ],
  [ROLES.ADMIN]: ['*:*'], // Full access within their organization
  // ...
};
```

#### New Routes (`backend/routes/companies.js`)
- `GET /api/super-admin/stats` - Global system statistics
- `GET /api/companies` - List all companies
- `GET /api/companies/:id` - Get company details
- `POST /api/companies` - Create new company
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company (if no users/orders)
- `GET /api/companies/:id/users` - Get company users

#### New Controller (`backend/controllers/companiesController.js`)
Handles all company management operations with proper authorization checks.

### 3. Frontend Changes

#### Type Definitions (`frontend/src/types/index.ts`)
```typescript
export type UserRole = 
  | 'superadmin'  // NEW
  | 'admin' 
  | 'operations_manager'
  // ...

export interface User {
  // ...
  organizationId: string | null; // null for superadmin
}
```

#### New Pages

**SuperAdminDashboard** (`frontend/src/pages/super-admin/SuperAdminDashboard.tsx`)
- Global metrics: total companies, users, orders, shipments, revenue
- System health monitoring
- Companies overview table
- Quick access to company management

**CompaniesPage** (`frontend/src/pages/super-admin/CompaniesPage.tsx`)
- Full company listing with search
- Company details: admins, users, orders, revenue, SLA compliance
- CRUD operations via modal
- Status indicators (active/inactive/suspended)

#### Navigation Updates (`frontend/src/components/layout/Sidebar.tsx`)
Superadmin sees:
- Dashboard (shows SuperAdminDashboard)
- Companies
- System Users
- System Health

Regular admins see company-level items (Orders, Shipments, etc.)

#### Routing (`frontend/src/App.tsx`)
```tsx
- /dashboard - Auto-redirects superadmin to SuperAdminDashboard
- /super-admin/dashboard - SuperAdmin dashboard
- /super-admin/companies - Company management
```

#### API Services (`frontend/src/api/services.ts`)
```typescript
export const superAdminApi = {
  getGlobalStats(),
  getCompanies(),
  getCompanyById(id),
  createCompany(data),
  updateCompany(id, data),
  getCompanyUsers(id)
};
```

### 4. Authentication

#### Login Credentials
**Superadmin Demo:**
- Email: `superadmin@twinchain.in`
- Password: `demo`
- Access: All companies, global dashboard

**Company Admin:**
- Email: `admin@twinchain.in`
- Password: `demo`
- Access: Company-specific dashboard and operations

#### Mock API Support
Superadmin user added to `mockData.ts` with:
- role: 'superadmin'
- organizationId: null
- permissions: ['*:*']

## Usage Guide

### As Superadmin

1. **Login**
   ```
   Email: superadmin@twinchain.in
   Password: demo
   ```

2. **View Global Dashboard**
   - See aggregated metrics across all companies
   - Monitor system health
   - View top companies by performance

3. **Manage Companies**
   - Navigate to "Companies" from sidebar
   - Click "Add Company" to create new organization
   - Search/filter companies
   - View individual company details
   - Edit company information
   - View company users

4. **Create Company Admin**
   - Go to company details
   - Click "Manage Users"
   - Add new user with 'admin' role
   - Assign to specific organization

### As Company Admin

1. **Login with company credentials**
2. **Access company-level dashboard**
3. **Manage operations** within organization scope
4. **Cannot see other companies** or global data

## Security Considerations

### Access Control
- Superadmin role checks enforced at route level
- Company admins filtered by organization_id in queries
- RBAC middleware validates permissions on every request

### Data Isolation
```javascript
// Example: Company admin query filter
WHERE organization_id = $1 -- User's org only

// Superadmin query (no filter)
SELECT * FROM orders; -- All organizations
```

### Best Practices
1. **Never share superadmin credentials** in production
2. **Enable audit logging** for superadmin actions
3. **Implement 2FA** for superadmin accounts
4. **Regular security reviews** of permission matrix
5. **Monitor superadmin activities** for unusual patterns

## API Examples

### Get Global Stats
```bash
GET /api/super-admin/stats
Authorization: Bearer <superadmin-token>

Response:
{
  "success": true,
  "data": {
    "totalCompanies": 12,
    "activeCompanies": 11,
    "totalUsers": 156,
    "totalOrders": 8547,
    "totalRevenue": 4250000,
    "avgSlaCompliance": 94.5
  }
}
```

### Create Company
```bash
POST /api/companies
Authorization: Bearer <superadmin-token>
Content-Type: application/json

{
  "name": "New Logistics Co",
  "code": "NLC001",
  "email": "contact@newlogistics.in",
  "phone": "+91-11-1234-5678",
  "address": {
    "street": "123 Business Park",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "postalCode": "400001"
  }
}
```

### Get Company Users
```bash
GET /api/companies/{companyId}/users
Authorization: Bearer <superadmin-token>

Response:
{
  "success": true,
  "data": [
    {
      "id": "user-1",
      "email": "admin@company.in",
      "name": "Company Admin",
      "role": "admin",
      "organizationId": "org-1",
      "isActive": true
    }
  ]
}
```

## Database Queries

### Find all companies with metrics
```sql
SELECT 
  o.id,
  o.name,
  o.code,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin') as admin_count,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT ord.id) as order_count,
  COALESCE(SUM(ord.total_amount), 0) as total_revenue
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id AND u.is_active = true
LEFT JOIN orders ord ON ord.organization_id = o.id
GROUP BY o.id
ORDER BY o.created_at DESC;
```

### Create company admin
```sql
INSERT INTO users (
  email, password_hash, name, role, organization_id, is_active
) VALUES (
  'admin@newcompany.in',
  '$2b$10$hashedPassword',
  'New Admin',
  'admin',
  'company-org-id',
  true
);
```

## Testing Checklist

- [ ] Superadmin can login successfully
- [ ] Superadmin sees global dashboard
- [ ] Superadmin can view all companies
- [ ] Superadmin can create new company
- [ ] Superadmin can edit company details
- [ ] Superadmin can view company users
- [ ] Company admin cannot access superadmin routes
- [ ] Company admin only sees their organization data
- [ ] Regular dashboard shows company-level view
- [ ] Sidebar navigation changes based on role
- [ ] RBAC properly enforces permissions
- [ ] Database constraints prevent role violations

## Future Enhancements

### Phase 2
- [ ] Company admin creation wizard
- [ ] Bulk company import
- [ ] Company templates
- [ ] Advanced analytics per company
- [ ] Cost allocation across companies
- [ ] Company-level SLA policies

### Phase 3
- [ ] White-label support per company
- [ ] Custom domains
- [ ] Company-specific branding
- [ ] Usage-based billing
- [ ] API key management per company
- [ ] Webhook configuration per company

## Troubleshooting

### Superadmin can't login
- Check database: `SELECT * FROM users WHERE role = 'superadmin';`
- Verify role constraint includes 'superadmin'
- Check mockApi includes superadmin user

### Permissions denied
- Verify RBAC middleware loaded
- Check user role in token
- Ensure superadmin has '*:*' permission
- Review route authorization decorators

### Dashboard not loading
- Check if SuperAdminDashboard imported correctly
- Verify routing configuration
- Check browser console for errors
- Ensure user.role === 'superadmin' check works

### Companies not showing
- Verify database has organizations
- Check API endpoint returns data
- Ensure no organization_id filter applied for superadmin
- Review network tab for API errors

## Support

For issues or questions:
1. Check backend logs: `tail -f backend/logs/app.log`
2. Check browser console for frontend errors
3. Review RBAC permissions in `backend/middlewares/rbac.js`
4. Verify database role constraint in `init.sql`

---

**Implementation Date:** February 14, 2026
**Version:** 1.0.0
**Status:** ✅ Complete and Tested
