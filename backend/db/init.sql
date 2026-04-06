-- SQLite schema for LaundroBot

-- Tenants (one per Facebook Page / branch)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fb_page_id TEXT UNIQUE NOT NULL,
  fb_page_access_token TEXT NOT NULL,
  xendit_api_key TEXT,
  logo_url TEXT,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users (admin per tenant + superadmin)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Customers (per tenant)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  phone TEXT,
  fb_id TEXT NOT NULL,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, fb_id),
  FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Services (per tenant)
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  unit TEXT DEFAULT 'per kg',
  description TEXT,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  customer_id TEXT,
  service_id INTEGER,
  weight REAL,
  price REAL NOT NULL,
  pickup_date DATETIME,
  address TEXT,
  status TEXT DEFAULT 'NEW ORDER',
  paid BOOLEAN DEFAULT 0,
  xendit_invoice_id TEXT,
  xendit_invoice_url TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id) REFERENCES customers(id),
  FOREIGN KEY(service_id) REFERENCES services(id)
);

-- Messenger conversation state (for chatbot flow)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  fb_user_id TEXT NOT NULL,
  step TEXT DEFAULT 'START',
  data TEXT DEFAULT '{}',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, fb_user_id),
  FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Blast message logs
CREATE TABLE IF NOT EXISTS blast_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  message TEXT,
  filter_status TEXT,
  sent_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lookup ON conversations(tenant_id, fb_user_id);
