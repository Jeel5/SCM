-- Migration: Add Superadmin Role Support
-- Description: Updates the users table to support superadmin role and adds default superadmin user
-- Date: 2026-02-14
-- Author: System

-- Step 1: Update the role constraint to include 'superadmin'
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('superadmin', 'admin', 'operations_manager', 'warehouse_manager', 'carrier_partner', 'finance', 'customer_support'));

-- Step 2: Allow organization_id to be NULL (for superadmin)
-- This should already be the case, but let's ensure it
-- No action needed if already nullable

-- Step 3: Insert superadmin user if not exists
INSERT INTO users (email, password_hash, name, role, organization_id, avatar, is_active)
SELECT 
  'superadmin@twinchain.in',
  '$2b$10$demoHashedPassword',  -- Change this in production!
  'Super Admin',
  'superadmin',
  NULL,  -- No organization
  'https://api.dicebear.com/7.x/avataaars/svg?seed=SuperAdmin',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'superadmin@twinchain.in'
);

-- Step 4: Verify the changes
DO $$
BEGIN
  -- Check if superadmin role exists in constraint
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'users_role_check' 
    AND pg_get_constraintdef(oid) LIKE '%superadmin%'
  ) THEN
    RAISE NOTICE 'SUCCESS: Superadmin role added to constraint';
  ELSE
    RAISE WARNING 'WARNING: Superadmin role may not be properly added';
  END IF;

  -- Check if superadmin user exists
  IF EXISTS (SELECT 1 FROM users WHERE role = 'superadmin') THEN
    RAISE NOTICE 'SUCCESS: Superadmin user created';
  ELSE
    RAISE WARNING 'WARNING: Superadmin user not created';
  END IF;
END $$;

-- Step 5: Grant necessary permissions (optional, based on your setup)
-- If you have a permissions table, add superadmin permissions here

-- Rollback script (save separately if needed):
/*
-- To rollback this migration:

-- 1. Delete superadmin user
DELETE FROM users WHERE role = 'superadmin';

-- 2. Restore original constraint
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'operations_manager', 'warehouse_manager', 'carrier_partner', 'finance', 'customer_support'));
*/

-- Notes:
-- 1. Remember to change the password hash in production
-- 2. Consider enabling 2FA for superadmin accounts
-- 3. Audit log all superadmin actions
-- 4. Regularly review superadmin access
