-- ================================================================================
-- Seed Carrier Partners for Testing
-- ================================================================================
-- Run this after init.sql to populate carriers table with test data
-- These are the carrier codes used in the HTML simulation portal

-- Insert carrier partners with human-readable codes
INSERT INTO carriers (code, name, contact_email, contact_phone, service_type, reliability_score, is_active, availability_status) VALUES
  ('DHL-001', 'DHL Express India', 'ops@dhl-india.com', '+91-1800-111-345', 'express', 0, true, 'offline'),
  ('FEDEX-001', 'FedEx India', 'operations@fedex.co.in', '+91-1800-102-332', 'express', 0, true, 'offline'),
  ('UPS-001', 'UPS Supply Chain Solutions', 'dispatch@ups-india.com', '+91-1860-266-6877', 'all', 0, true, 'offline'),
  ('BLUEDART-001', 'Blue Dart Express', 'support@bluedart.com', '+91-1860-233-3333', 'express', 0, true, 'offline'),
  ('DTDC-001', 'DTDC Courier & Cargo', 'info@dtdc.com', '+91-1860-208-0208', 'standard', 0, true, 'offline'),
  ('ECOM-001', 'Ecom Express', 'ops@ecomexpress.in', '+91-1800-1200-9030', 'standard', 0, true, 'offline'),
  ('DELHIVERY-001', 'Delhivery Logistics', 'support@delhivery.com', '+91-1800-103-7878', 'all', 0, true, 'offline'),
  ('XPRESSBEES-001', 'Xpressbees Logistics', 'operations@xpressbees.com', '+91-1800-1233-303', 'standard', 0, true, 'offline')
ON CONFLICT (code) DO NOTHING;

-- Show what was inserted
SELECT code, name, service_type, reliability_score, availability_status 
FROM carriers 
ORDER BY reliability_score DESC;
