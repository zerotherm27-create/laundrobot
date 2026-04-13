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

-- Services (per tenant)
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  unit TEXT DEFAULT 'per kg',
  description TEXT,
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

-- Indexes for performance
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_conversations_lookup ON conversations(tenant_id, fb_user_id);