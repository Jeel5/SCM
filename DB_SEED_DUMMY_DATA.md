# Logistics Control Tower – Dummy Data Seed

Purpose: Healthy dataset for local development and demos. Run the SQL in a PostgreSQL client connected to your project DB. All inserts respect foreign keys via subselects on stable business keys (codes, emails, skus, tracking numbers).

## How to Use

1. Ensure tables exist (as per your schema).
2. Enable `gen_random_uuid()` (pgcrypto) if not already.
3. Copy the SQL block below into `psql` or your GUI and run.
4. Re-run safely: Designed with unique business keys to avoid duplicates.

```sql
BEGIN;

-- Organizations
INSERT INTO organizations (name, code) VALUES
  ('Demo Logistics Inc','DEMO001'),
  ('Acme Retail Corp','ACME001')
ON CONFLICT (code) DO NOTHING;

-- Users (admin, ops, warehouse, carrier, finance, support)
INSERT INTO users (email, password_hash, name, role, organization_id, avatar, is_active)
SELECT * FROM (VALUES
  ('admin@logitower.com','$2b$10$demoHashedPassword','John Admin','admin', (SELECT id FROM organizations WHERE code='DEMO001'),'https://api.dicebear.com/7.x/avataaars/svg?seed=John',true),
  ('ops@logitower.com','$2b$10$demoHashedPassword','Sarah Operations','operations_manager', (SELECT id FROM organizations WHERE code='DEMO001'),'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',true),
  ('wh1@logitower.com','$2b$10$demoHashedPassword','Luis Warehouse','warehouse_manager', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('wh2@logitower.com','$2b$10$demoHashedPassword','Priya Warehouse','warehouse_manager', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('carrier@logitower.com','$2b$10$demoHashedPassword','DHL Partner','carrier_partner', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('finance@logitower.com','$2b$10$demoHashedPassword','Alice Finance','finance', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('support@logitower.com','$2b$10$demoHashedPassword','Bob Support','customer_support', (SELECT id FROM organizations WHERE code='DEMO001'),NULL,true),
  ('admin@acme.com','$2b$10$demoHashedPassword','Acme Admin','admin', (SELECT id FROM organizations WHERE code='ACME001'),NULL,true)
) AS v(email, password_hash, name, role, organization_id, avatar, is_active)
ON CONFLICT (email) DO NOTHING;

-- User Permissions
INSERT INTO user_permissions (user_id, permission)
SELECT u.id, p.permission FROM users u JOIN (VALUES
  ('admin@logitower.com','all'),
  ('ops@logitower.com','orders'),('ops@logitower.com','shipments'),('ops@logitower.com','sla'),('ops@logitower.com','exceptions'),
  ('finance@logitower.com','financials'),('finance@logitower.com','reports'),
  ('support@logitower.com','returns'),('support@logitower.com','exceptions')
) AS p(email, permission) ON u.email = p.email
ON CONFLICT DO NOTHING;

-- Warehouses
INSERT INTO warehouses (code, name, address, capacity, manager_id, is_active)
SELECT * FROM (VALUES
  ('WH-LA','Los Angeles Fulfillment Center', '{"street":"123 Industrial Blvd","city":"Los Angeles","state":"CA","postal_code":"90001","country":"USA","coordinates":{"lat":34.0522,"lng":-118.2437}}'::jsonb,50000,(SELECT id FROM users WHERE email='wh1@logitower.com'),true),
  ('WH-NY','New York Distribution Hub', '{"street":"456 Commerce Way","city":"New York","state":"NY","postal_code":"10001","country":"USA","coordinates":{"lat":40.7128,"lng":-74.006}}'::jsonb,35000,(SELECT id FROM users WHERE email='wh2@logitower.com'),true),
  ('WH-CHI','Chicago Cross-Dock Center', '{"street":"789 Logistics Dr","city":"Chicago","state":"IL","postal_code":"60601","country":"USA","coordinates":{"lat":41.8781,"lng":-87.6298}}'::jsonb,25000,(SELECT id FROM users WHERE email='wh1@logitower.com'),true),
  ('WH-MIA','Miami Cold Storage Facility', '{"street":"321 Refrigerated Ln","city":"Miami","state":"FL","postal_code":"33101","country":"USA","coordinates":{"lat":25.7617,"lng":-80.1918}}'::jsonb,15000,(SELECT id FROM users WHERE email='wh2@logitower.com'),true)
) AS v(code,name,address,capacity,manager_id,is_active)
ON CONFLICT (code) DO NOTHING;

-- Carriers
INSERT INTO carriers (code, name, service_type, contact_email, contact_phone, reliability_score, is_active) VALUES
  ('DHL','DHL Express','express','support@dhl.com','+1-800-225-5345',0.94,true),
  ('FEDEX','FedEx','express','support@fedex.com','+1-800-463-3339',0.93,true),
  ('UPS','UPS','express','support@ups.com','+1-800-742-5877',0.935,true),
  ('BLUEDART','BlueDart','standard','support@bluedart.com','+91-1860-233-1234',0.90,true),
  ('DELHIVERY','Delhivery','standard','support@delhivery.com','+91-1860-266-6766',0.88,true)
ON CONFLICT (code) DO NOTHING;

-- Rate Cards
INSERT INTO rate_cards (carrier_id, origin_state, destination_state, service_type, base_rate, per_kg_rate, fuel_surcharge_pct, effective_from, effective_to)
SELECT c.id, rc.origin, rc.dest, rc.service, rc.base, rc.perkg, rc.fuel, rc.fromd::date, rc.tod::date
FROM carriers c JOIN (VALUES
  ('DHL','CA','NY','express',12.00,1.50,12.5,'2024-01-01','2026-12-31'),
  ('DHL','CA','TX','express',10.00,1.30,12.0,'2024-01-01','2026-12-31'),
  ('FEDEX','CA','IL','express',11.00,1.40,11.5,'2024-01-01','2026-12-31'),
  ('UPS','CA','FL','express',10.50,1.35,11.0,'2024-01-01','2026-12-31'),
  ('BLUEDART','MH','DL','standard',8.00,1.10,10.0,'2024-01-01','2026-12-31'),
  ('DELHIVERY','KA','TN','standard',7.50,1.00,9.5,'2024-01-01','2026-12-31')
) AS rc(code,origin,dest,service,base,perkg,fuel,fromd,tod) ON c.code = rc.code;

-- Products
INSERT INTO products (sku, name, category, weight, dimensions, unit_price, is_active) VALUES
  ('SKU-10001','Wireless Headphones','electronics',0.45,'{"length":20,"width":15,"height":5}'::jsonb,79.99,true),
  ('SKU-10002','Smartphone Case','electronics',0.10,'{"length":10,"width":6,"height":2}'::jsonb,19.99,true),
  ('SKU-10003','Cotton T-Shirt','clothing',0.25,'{"length":30,"width":25,"height":3}'::jsonb,14.99,true),
  ('SKU-10004','Sneakers','clothing',0.80,'{"length":35,"width":25,"height":12}'::jsonb,59.99,true),
  ('SKU-10005','Office Chair','furniture',12.50,'{"length":60,"width":60,"height":90}'::jsonb,149.99,true),
  ('SKU-10006','LED Desk Lamp','furniture',1.20,'{"length":25,"width":15,"height":30}'::jsonb,29.99,true),
  ('SKU-10007','Engine Oil 5L','automotive',5.00,'{"length":25,"width":15,"height":30}'::jsonb,39.99,true),
  ('SKU-10008','Protein Powder 1kg','health',1.00,'{"length":20,"width":20,"height":25}'::jsonb,24.99,true),
  ('SKU-10009','Refrigerated Pack','food',2.50,'{"length":30,"width":20,"height":15}'::jsonb,34.99,true),
  ('SKU-10010','Wooden Table','furniture',20.00,'{"length":120,"width":60,"height":75}'::jsonb,199.99,true),
  ('SKU-10011','Bluetooth Speaker','electronics',0.65,'{"length":20,"width":10,"height":10}'::jsonb,49.99,true),
  ('SKU-10012','Winter Jacket','clothing',1.50,'{"length":50,"width":40,"height":10}'::jsonb,89.99,true),
  ('SKU-10013','Car Tyre','automotive',9.00,'{"length":70,"width":70,"height":25}'::jsonb,79.99,true),
  ('SKU-10014','Vitamins Pack','health',0.20,'{"length":10,"width":10,"height":5}'::jsonb,14.99,true),
  ('SKU-10015','Organic Juice','food',1.20,'{"length":25,"width":10,"height":10}'::jsonb,5.99,true),
  ('SKU-10016','Laptop Stand','electronics',0.75,'{"length":35,"width":25,"height":5}'::jsonb,29.99,true),
  ('SKU-10017','Jeans','clothing',0.80,'{"length":40,"width":30,"height":5}'::jsonb,39.99,true),
  ('SKU-10018','Sofa 3-Seater','furniture',35.00,'{"length":200,"width":90,"height":85}'::jsonb,499.99,true),
  ('SKU-10019','Brake Pads','automotive',2.00,'{"length":25,"width":20,"height":10}'::jsonb,29.99,true),
  ('SKU-10020','Face Mask 50pcs','health',0.50,'{"length":20,"width":15,"height":10}'::jsonb,9.99,true)
ON CONFLICT (sku) DO NOTHING;

-- SLA Policies
INSERT INTO sla_policies (name, service_type, origin_region, destination_region, delivery_hours, penalty_per_hour, is_active) VALUES
  ('Express Delivery - Metro','express','Metro','Metro',24,50,true),
  ('Standard Delivery - Nationwide','standard','Nationwide','Nationwide',72,10,true),
  ('Bulk Shipping - Regional','bulk','Regional','Regional',120,25,true)
ON CONFLICT DO NOTHING;

-- Inventory (selected combinations for healthy stock levels)
INSERT INTO inventory (warehouse_id, product_id, available_quantity, reserved_quantity, damaged_quantity, last_stock_check)
SELECT w.id, p.id, i.avail, i.resv, i.dmg, NOW()
FROM warehouses w, products p, (VALUES
  ('WH-LA','SKU-10001',120,10,2),('WH-LA','SKU-10005',40,5,0),('WH-LA','SKU-10010',25,2,1),('WH-LA','SKU-10018',10,0,0),
  ('WH-NY','SKU-10003',300,30,5),('WH-NY','SKU-10012',80,8,1),('WH-NY','SKU-10020',200,20,0),('WH-NY','SKU-10007',60,6,0),
  ('WH-CHI','SKU-10004',150,12,3),('WH-CHI','SKU-10011',90,9,0),('WH-CHI','SKU-10013',30,3,1),('WH-CHI','SKU-10019',70,5,1),
  ('WH-MIA','SKU-10009',110,10,2),('WH-MIA','SKU-10015',180,15,0),('WH-MIA','SKU-10006',95,7,0),('WH-MIA','SKU-10016',85,8,0)
) AS i(wcode,sku,avail,resv,dmg)
WHERE w.code = i.wcode AND p.sku = i.sku
ON CONFLICT DO NOTHING;

-- Orders
INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, status, priority, total_amount, currency, shipping_address, billing_address, estimated_delivery, notes)
VALUES
  ('ORD-100001','Alice Johnson','alice@example.com','+1-555-0100','created','express',149.98,'USD','{"street":"456 Customer Ave","city":"New York","state":"NY","postal_code":"10001","country":"USA"}'::jsonb,'{"street":"456 Customer Ave","city":"New York","state":"NY","postal_code":"10001","country":"USA"}'::jsonb, NOW() + INTERVAL '2 days','High priority'),
  ('ORD-100002','Bob Smith','bob@example.com','+1-555-0101','confirmed','standard',89.99,'USD','{"street":"789 Market St","city":"Los Angeles","state":"CA","postal_code":"90001","country":"USA"}'::jsonb,'{"street":"789 Market St","city":"Los Angeles","state":"CA","postal_code":"90001","country":"USA"}'::jsonb, NOW() + INTERVAL '3 days',NULL),
  ('ORD-100003','Carol Davis','carol@example.com','+1-555-0102','allocated','standard',199.99,'USD','{"street":"321 Broadway","city":"Chicago","state":"IL","postal_code":"60601","country":"USA"}'::jsonb,'{"street":"321 Broadway","city":"Chicago","state":"IL","postal_code":"60601","country":"USA"}'::jsonb, NOW() + INTERVAL '4 days',NULL),
  ('ORD-100004','David Lee','david@example.com','+1-555-0103','shipped','express',79.99,'USD','{"street":"654 Ocean Dr","city":"Miami","state":"FL","postal_code":"33101","country":"USA"}'::jsonb,'{"street":"654 Ocean Dr","city":"Miami","state":"FL","postal_code":"33101","country":"USA"}'::jsonb, NOW() + INTERVAL '1 day','Fragile'),
  ('ORD-100005','Emma Wilson','emma@example.com','+1-555-0104','delivered','standard',39.98,'USD','{"street":"987 Elm St","city":"Philadelphia","state":"PA","postal_code":"19019","country":"USA"}'::jsonb,'{"street":"987 Elm St","city":"Philadelphia","state":"PA","postal_code":"19019","country":"USA"}'::jsonb, NOW() - INTERVAL '1 day','Delivered on time'),
  ('ORD-100006','Frank Miller','frank@example.com','+1-555-0105','returned','bulk',499.99,'USD','{"street":"555 Pine St","city":"San Diego","state":"CA","postal_code":"92101","country":"USA"}'::jsonb,'{"street":"555 Pine St","city":"San Diego","state":"CA","postal_code":"92101","country":"USA"}'::jsonb, NOW() + INTERVAL '5 days','Oversized')
ON CONFLICT (order_number) DO NOTHING;

-- Order Items
INSERT INTO order_items (order_id, product_id, sku, product_name, quantity, unit_price, weight)
SELECT o.id, p.id, p.sku, p.name, oi.qty, p.unit_price, p.weight
FROM orders o JOIN (VALUES
  ('ORD-100001','SKU-10001',2),('ORD-100001','SKU-10016',1),
  ('ORD-100002','SKU-10012',1),('ORD-100002','SKU-10020',2),
  ('ORD-100003','SKU-10010',1),
  ('ORD-100004','SKU-10011',1),
  ('ORD-100005','SKU-10003',2),
  ('ORD-100006','SKU-10018',1)
) AS oi(ord,sku,qty) ON o.order_number = oi.ord
JOIN products p ON p.sku = oi.sku;

-- Shipments
INSERT INTO shipments (tracking_number, order_id, carrier_id, warehouse_id, status, origin_address, destination_address, weight, shipping_cost, pickup_scheduled)
SELECT * FROM (
  SELECT 'TRK123456789', (SELECT id FROM orders WHERE order_number='ORD-100004'), (SELECT id FROM carriers WHERE code='DHL'), (SELECT id FROM warehouses WHERE code='WH-LA'), 'in_transit', '{"street":"123 Industrial Blvd","city":"Los Angeles","state":"CA","postal_code":"90001","country":"USA"}'::jsonb, (SELECT shipping_address FROM orders WHERE order_number='ORD-100004'), 1.65, 12.50, NOW() - INTERVAL '1 day'
) AS s
ON CONFLICT (tracking_number) DO NOTHING;
INSERT INTO shipments (tracking_number, order_id, carrier_id, warehouse_id, status, origin_address, destination_address, weight, shipping_cost, pickup_scheduled)
SELECT * FROM (
  SELECT 'TRK987654321', (SELECT id FROM orders WHERE order_number='ORD-100003'), (SELECT id FROM carriers WHERE code='UPS'), (SELECT id FROM warehouses WHERE code='WH-CHI'), 'picked_up', '{"street":"789 Logistics Dr","city":"Chicago","state":"IL","postal_code":"60601","country":"USA"}'::jsonb, (SELECT shipping_address FROM orders WHERE order_number='ORD-100003'), 20.00, 25.00, NOW() - INTERVAL '2 days'
) AS s
ON CONFLICT (tracking_number) DO NOTHING;

-- Shipment Events
INSERT INTO shipment_events (shipment_id, event_type, location, description, event_timestamp)
SELECT s.id, e.type, e.loc, e.description, e.ts FROM shipments s JOIN (VALUES
  ('TRK123456789','created','{"city":"Los Angeles","state":"CA"}'::jsonb,'Shipment created', NOW() - INTERVAL '1 day'),
  ('TRK123456789','in_transit','{"city":"Phoenix","state":"AZ"}'::jsonb,'Departed hub', NOW() - INTERVAL '12 hours'),
  ('TRK987654321','created','{"city":"Chicago","state":"IL"}'::jsonb,'Shipment created', NOW() - INTERVAL '2 days'),
  ('TRK987654321','picked_up','{"city":"Chicago","state":"IL"}'::jsonb,'Picked up by carrier', NOW() - INTERVAL '36 hours')
) AS e(trk,type,loc,description,ts) ON s.tracking_number = e.trk;

-- SLA Violations
INSERT INTO sla_violations (shipment_id, sla_policy_id, promised_delivery, actual_delivery, delay_hours, penalty_amount, reason, status)
SELECT s.id, sp.id, NOW() - INTERVAL '12 hours', NOW(), 12, 120, 'Delayed due to weather','open'
FROM shipments s, sla_policies sp WHERE s.tracking_number='TRK987654321' AND sp.name='Standard Delivery - Nationwide'
ON CONFLICT DO NOTHING;

-- Returns
INSERT INTO returns (rma_number, order_id, shipment_id, reason, status, refund_amount, requested_at)
SELECT 'RMA-100001', (SELECT id FROM orders WHERE order_number='ORD-100006'), (SELECT id FROM shipments WHERE tracking_number='TRK987654321'), 'damaged','requested', 49.99, NOW() - INTERVAL '3 days'
ON CONFLICT (rma_number) DO NOTHING;

-- Return Items
INSERT INTO return_items (return_id, order_item_id, product_id, quantity, reason_detail)
SELECT r.id, oi.id, oi.product_id, 1, 'Corner damage'
FROM returns r JOIN orders o ON r.order_id = o.id
JOIN order_items oi ON oi.order_id = o.id
WHERE r.rma_number='RMA-100001' AND oi.sku='SKU-10018'
ON CONFLICT DO NOTHING;

-- Exceptions
INSERT INTO exceptions (exception_type, severity, shipment_id, order_id, description, status, assigned_to, sla_impacted)
SELECT 'delay','high', s.id, o.id, 'Carrier delay due to weather', 'open', (SELECT id FROM users WHERE email='support@logitower.com'), true
FROM shipments s JOIN orders o ON s.order_id = o.id WHERE s.tracking_number='TRK987654321'
ON CONFLICT DO NOTHING;

-- ETA Predictions
INSERT INTO eta_predictions (shipment_id, predicted_delivery, confidence_score, delay_risk_score, factors)
SELECT s.id, NOW() + INTERVAL '36 hours', 0.85, 'medium', '{"baseHours":72,"bufferHours":12}'::jsonb
FROM shipments s WHERE s.tracking_number='TRK123456789'
ON CONFLICT DO NOTHING;

-- Notifications
INSERT INTO notifications (user_id, type, title, message, link, is_read)
SELECT u.id, n.type, n.title, n.message, n.link, n.read
FROM users u JOIN (VALUES
  ('admin@logitower.com','sla_breach','SLA Breach Alert','Order ORD-100003 breached SLA','/sla/violations',false),
  ('ops@logitower.com','shipment_update','Shipment In Transit','TRK123456789 departed Phoenix hub','/shipments',false),
  ('support@logitower.com','exception_alert','New Exception Created','Shipment TRK987654321 reported as delayed','/exceptions',false)
) AS n(email,type,title,message,link,read) ON u.email = n.email
ON CONFLICT DO NOTHING;

-- Invoices
INSERT INTO invoices (invoice_number, carrier_id, billing_period_start, billing_period_end, total_shipments, base_amount, penalties, adjustments, final_amount, status)
SELECT v.invoice_number,
       v.carrier_id,
       v.billing_period_start::date,
       v.billing_period_end::date,
       v.total_shipments,
       v.base_amount,
       v.penalties,
       v.adjustments,
       v.final_amount,
       v.status
FROM (VALUES
  ('INV-2024-001',(SELECT id FROM carriers WHERE code='DHL'),'2024-11-01','2024-11-30',1250,25000.00,500.00,0.00,25500.00,'approved'),
  ('INV-2024-002',(SELECT id FROM carriers WHERE code='UPS'),'2024-11-01','2024-11-30',980,20000.00,350.00,50.00,20400.00,'pending'),
  ('INV-2024-003',(SELECT id FROM carriers WHERE code='FEDEX'),'2024-11-01','2024-11-30',1100,22000.00,400.00,0.00,22400.00,'paid')
) AS v(invoice_number, carrier_id, billing_period_start, billing_period_end, total_shipments, base_amount, penalties, adjustments, final_amount, status)
ON CONFLICT (invoice_number) DO NOTHING;

COMMIT;
```

## Notes
- Password hashes are placeholders; replace with real bcrypt hashes for production.
- Adjust quantities and prices as needed for specific test scenarios.
- All JSON fields use compact formatting to reduce line count.
- The dataset covers all modules: Auth, MDM, Inventory, OMS, Shipments, SLA, Returns, Exceptions, ETA, Notifications, Financials.
