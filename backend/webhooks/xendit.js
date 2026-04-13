const router = require('express').Router();
const db = require('../db');

router.post('/', async (req, res) => {
  const callbackToken = req.headers['x-callback-token'];
  if (callbackToken !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(403).json({ error: 'Invalid callback token' });
  }

  const { external_id, status, id: xenditInvoiceId } = req.body;

  if (status !== 'PAID') return res.sendStatus(200);

  try {
    await db.query(
      `UPDATE orders SET paid=TRUE, status='PAID', xendit_invoice_id=$1
       WHERE id=$2`,
      [xenditInvoiceId, external_id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Xendit webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
