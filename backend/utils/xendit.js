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

module.exports = { createInvoice };
