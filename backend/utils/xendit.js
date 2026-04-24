const axios = require('axios');

async function createInvoice(apiKey, { externalId, amount, payerEmail, description, successRedirectUrl }) {
  const { data } = await axios.post(
    'https://api.xendit.co/v2/invoices',
    {
      external_id: externalId,
      amount,
      payer_email: payerEmail,
      description,
      success_redirect_url: successRedirectUrl,
    },
    {
      auth: { username: apiKey, password: '' },
    }
  );
  return { id: data.id, invoiceUrl: data.invoice_url };
}

async function createRefund(apiKey, { invoiceId, amount, reason }) {
  // Fetch invoice to get payment_id
  const { data: invoice } = await axios.get(
    `https://api.xendit.co/v2/invoices/${invoiceId}`,
    { auth: { username: apiKey, password: '' } }
  );

  const paymentId = invoice.payment_id;
  if (!paymentId) {
    throw new Error('No payment ID on invoice — payment method may not support auto-refund');
  }

  const { data } = await axios.post(
    'https://api.xendit.co/refunds',
    { payment_id: paymentId, amount, reason: reason || 'CANCELLATION' },
    {
      auth: { username: apiKey, password: '' },
      headers: { 'idempotency-key': `refund-${invoiceId}-${Date.now()}` },
    }
  );
  return data;
}

async function getInvoiceStatus(apiKey, invoiceId) {
  const { data } = await axios.get(
    `https://api.xendit.co/v2/invoices/${invoiceId}`,
    { auth: { username: apiKey, password: '' } }
  );
  return { status: data.status, id: data.id };
}

module.exports = { createInvoice, createRefund, getInvoiceStatus };
