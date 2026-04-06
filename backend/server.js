require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());
app.use('/users', require('./routes/users'));

// Routes
try {
  app.use('/auth',      require('./routes/auth'));
  console.log('✓ auth route loaded');
  app.use('/orders',    require('./routes/orders'));
  console.log('✓ orders route loaded');
  app.use('/services',  require('./routes/services'));
  console.log('✓ services route loaded');
  app.use('/customers', require('./routes/customers'));
  console.log('✓ customers route loaded');
  app.use('/tenants',   require('./routes/tenants'));
  console.log('✓ tenants route loaded');
  app.use('/messaging', require('./routes/messaging'));
  console.log('✓ messaging route loaded');

  // Webhooks (no auth middleware)
  app.use('/webhook/messenger', require('./webhooks/messenger'));
  console.log('✓ webhook messenger loaded');
  app.use('/webhook/xendit',    require('./webhooks/xendit'));
  console.log('✓ webhook xendit loaded');
} catch (err) {
  console.error('Error loading routes:', err.message);
  process.exit(1);
}

app.get('/', (req, res) => res.json({ status: 'LaundroBot API running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});