require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/auth',      require('./routes/auth'));
app.use('/orders',    require('./routes/orders'));
app.use('/services',  require('./routes/services'));
app.use('/customers', require('./routes/customers'));
app.use('/tenants',   require('./routes/tenants'));
app.use('/messaging', require('./routes/messaging'));
app.use('/users',     require('./routes/users'));

// Webhooks
app.use('/webhook/messenger', require('./webhooks/messenger'));
app.use('/webhook/xendit',    require('./webhooks/xendit'));

app.get('/', (req, res) => {
  res.json({ status: 'LaundroBot API running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
}); 
