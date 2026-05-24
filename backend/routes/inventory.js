const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../db');

// GET /inventory/items
router.get('/items', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, unit, current_stock, reorder_threshold, cost_per_unit
       FROM inventory_items WHERE tenant_id=$1 ORDER BY name`,
      [req.user.tenant_id]
    );
    res.json(rows.map(r => ({
      ...r,
      current_stock:     parseFloat(r.current_stock)     || 0,
      reorder_threshold: parseFloat(r.reorder_threshold) || 0,
      cost_per_unit:     parseFloat(r.cost_per_unit)     || 0,
    })));
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /inventory/items
router.post('/items', auth, async (req, res) => {
  try {
    const { name, unit, reorder_threshold, cost_per_unit } = req.body;
    if (!name || !unit) return res.status(400).json({ error: 'name and unit required' });
    const { rows } = await db.query(
      `INSERT INTO inventory_items (tenant_id, name, unit, reorder_threshold, cost_per_unit)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.tenant_id, name.trim(), unit.trim(), parseFloat(reorder_threshold)||0, parseFloat(cost_per_unit)||0]
    );
    res.json({ ...rows[0], current_stock: 0, reorder_threshold: parseFloat(rows[0].reorder_threshold)||0, cost_per_unit: parseFloat(rows[0].cost_per_unit)||0 });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'An item with this name already exists.' });
    console.error(e); res.status(500).json({ error: e.message });
  }
});

// PUT /inventory/items/:id
router.put('/items/:id', auth, async (req, res) => {
  try {
    const { name, unit, reorder_threshold, cost_per_unit } = req.body;
    const { rows } = await db.query(
      `UPDATE inventory_items SET
         name=$1, unit=$2, reorder_threshold=$3, cost_per_unit=$4
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [name, unit, parseFloat(reorder_threshold)||0, parseFloat(cost_per_unit)||0,
       req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json({ ...rows[0], current_stock: parseFloat(rows[0].current_stock)||0, reorder_threshold: parseFloat(rows[0].reorder_threshold)||0, cost_per_unit: parseFloat(rows[0].cost_per_unit)||0 });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// DELETE /inventory/items/:id
router.delete('/items/:id', auth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM inventory_items WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /inventory/stock-in  { item_id, quantity, note }
router.post('/stock-in', auth, async (req, res) => {
  try {
    const { item_id, quantity, note } = req.body;
    if (!item_id || !quantity || quantity <= 0) return res.status(400).json({ error: 'item_id and positive quantity required' });
    const tid = req.user.tenant_id;
    await db.query(
      `UPDATE inventory_items SET current_stock = current_stock + $1 WHERE id=$2 AND tenant_id=$3`,
      [parseFloat(quantity), item_id, tid]
    );
    const { rows } = await db.query(
      `INSERT INTO inventory_transactions (tenant_id, item_id, type, quantity, note)
       VALUES ($1,$2,'in',$3,$4) RETURNING *`,
      [tid, item_id, parseFloat(quantity), note || null]
    );
    const { rows: [item] } = await db.query(
      `SELECT id, name, unit, current_stock, reorder_threshold FROM inventory_items WHERE id=$1`,
      [item_id]
    );
    res.json({ transaction: rows[0], item: { ...item, current_stock: parseFloat(item.current_stock)||0 } });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /inventory/stock-out  { item_id, quantity, note }  — manual consumption (e.g. daily LPG usage)
router.post('/stock-out', auth, async (req, res) => {
  try {
    const { item_id, quantity, note } = req.body;
    if (!item_id || !quantity || quantity <= 0) return res.status(400).json({ error: 'item_id and positive quantity required' });
    const tid = req.user.tenant_id;
    await db.query(
      `UPDATE inventory_items SET current_stock = GREATEST(0, current_stock - $1) WHERE id=$2 AND tenant_id=$3`,
      [parseFloat(quantity), item_id, tid]
    );
    const { rows } = await db.query(
      `INSERT INTO inventory_transactions (tenant_id, item_id, type, quantity, note)
       VALUES ($1,$2,'out',$3,$4) RETURNING *`,
      [tid, item_id, parseFloat(quantity), note || null]
    );
    const { rows: [item] } = await db.query(
      `SELECT id, name, unit, current_stock, reorder_threshold FROM inventory_items WHERE id=$1`,
      [item_id]
    );
    res.json({ transaction: rows[0], item: { ...item, current_stock: parseFloat(item.current_stock)||0 } });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// GET /inventory/transactions?item_id=&limit=200
router.get('/transactions', auth, async (req, res) => {
  try {
    const { item_id, limit = 200 } = req.query;
    const params = [req.user.tenant_id, parseInt(limit) || 200];
    let where = 'it.tenant_id=$1';
    if (item_id) { where += ` AND it.item_id=$${params.length + 1}`; params.push(item_id); }
    const { rows } = await db.query(
      `SELECT it.id, it.type, it.quantity, it.note, it.created_at, it.order_id,
              ii.name AS item_name, ii.unit
       FROM inventory_transactions it
       JOIN inventory_items ii ON ii.id = it.item_id
       WHERE ${where}
       ORDER BY it.created_at DESC LIMIT $2`,
      params
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// GET /inventory/formulas
router.get('/formulas', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT sf.id, sf.service_id, sf.item_id, sf.quantity_per_order,
              sf.variant_label, sf.variant_value,
              s.name AS service_name, ii.name AS item_name, ii.unit
       FROM service_formulas sf
       JOIN services s ON s.id = sf.service_id
       JOIN inventory_items ii ON ii.id = sf.item_id
       WHERE sf.tenant_id=$1
       ORDER BY s.name, sf.variant_label, sf.variant_value, ii.name`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// PUT /inventory/formulas  { service_id, item_id, quantity_per_order, variant_label?, variant_value? }
router.put('/formulas', auth, async (req, res) => {
  try {
    const { service_id, item_id, quantity_per_order, variant_label = '', variant_value = '' } = req.body;
    if (!service_id || !item_id || quantity_per_order == null) {
      return res.status(400).json({ error: 'service_id, item_id, quantity_per_order required' });
    }
    const { rows } = await db.query(
      `INSERT INTO service_formulas (tenant_id, service_id, item_id, quantity_per_order, variant_label, variant_value)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ON CONSTRAINT service_formulas_unique_variant
       DO UPDATE SET quantity_per_order = EXCLUDED.quantity_per_order
       RETURNING *`,
      [req.user.tenant_id, service_id, item_id, parseFloat(quantity_per_order)||0, variant_label.trim(), variant_value.trim()]
    );
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// DELETE /inventory/formulas/:id
router.delete('/formulas/:id', auth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM service_formulas WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// Internal: called from orders.js on COMPLETED — fire-and-forget
async function deductInventory(order, tenantId) {
  if (!order.service_id) return;
  const selections = Array.isArray(order.custom_selections) ? order.custom_selections : [];

  // Quantity multiplier — look for a "Quantity" field in selections
  const qtySelection = selections.find(s => s.label === 'Quantity');
  const orderQty = Math.max(1, parseInt(qtySelection?.value) || 1);

  const { rows: formulas } = await db.query(
    `SELECT item_id, quantity_per_order, variant_label, variant_value
     FROM service_formulas WHERE tenant_id=$1 AND service_id=$2`,
    [tenantId, order.service_id]
  );
  if (!formulas.length) return;

  // Two-pass: collect defaults (all-variants), then override with specific variant matches
  const itemQty = {};
  // Pass 1: "all variants" rows (both variant fields are empty string)
  for (const f of formulas) {
    if (!f.variant_label && !f.variant_value) {
      itemQty[f.item_id] = parseFloat(f.quantity_per_order) || 0;
    }
  }
  // Pass 2: exact variant match overrides the default
  for (const f of formulas) {
    if (f.variant_label && f.variant_value) {
      const matched = selections.some(
        s => s.label === f.variant_label && s.value === f.variant_value
      );
      if (matched) {
        itemQty[f.item_id] = parseFloat(f.quantity_per_order) || 0;
      }
    }
  }

  const ref = order.booking_ref || order.id;
  for (const [item_id, qty] of Object.entries(itemQty)) {
    const totalQty = qty * orderQty;
    if (totalQty <= 0) continue;
    await db.query(
      `UPDATE inventory_items SET current_stock = GREATEST(0, current_stock - $1)
       WHERE id=$2 AND tenant_id=$3`,
      [totalQty, item_id, tenantId]
    );
    await db.query(
      `INSERT INTO inventory_transactions (tenant_id, item_id, type, quantity, note, order_id)
       VALUES ($1,$2,'out',$3,$4,$5)`,
      [tenantId, item_id, totalQty,
       `Auto-deducted: order ${ref}${orderQty > 1 ? ` (qty×${orderQty})` : ''}`,
       order.id]
    );
  }
}

module.exports = router;
module.exports.deductInventory = deductInventory;
