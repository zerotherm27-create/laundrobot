-- Run this in your Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants (one per Facebook Page / branch)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fb_page_id TEXT UNIQUE NOT NULL,
  fb_page_access_token TEXT NOT NULL,
  xendit_api_key TEXT,
  logo_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users (admin per tenant + superadmin)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin', -- 'superadmin' | 'admin'
  permissions TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration: run these if the table already exists
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT '[]';

-- Fix archived NULLs so kanban query (archived = FALSE) matches new orders:
-- ALTER TABLE orders ALTER COLUMN archived SET DEFAULT FALSE;
-- UPDATE orders SET archived = FALSE WHERE archived IS NULL;

-- Customers (per tenant)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  fb_id TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, fb_id)
);

-- Service categories (per tenant)
CREATE TABLE service_categories (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Services (per tenant)
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  category_id INT REFERENCES service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  unit TEXT DEFAULT 'per kg',
  description TEXT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  service_id INT REFERENCES services(id),
  weight NUMERIC,
  price NUMERIC NOT NULL,
  pickup_date TIMESTAMP,
  address TEXT,
  status TEXT DEFAULT 'NEW ORDER',
  paid BOOLEAN DEFAULT FALSE,
  xendit_invoice_id TEXT,
  xendit_invoice_url TEXT,
  notes TEXT,
  reminder_count INT DEFAULT 0,
  last_reminded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messenger conversation state (for chatbot flow)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  fb_user_id TEXT NOT NULL,
  step TEXT DEFAULT 'START',
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, fb_user_id)
);

-- Blast message logs
CREATE TABLE blast_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  message TEXT,
  filter_status TEXT,
  sent_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- FAQs (customizable per tenant, shown in Messenger)
CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_conversations_lookup ON conversations(tenant_id, fb_user_id);