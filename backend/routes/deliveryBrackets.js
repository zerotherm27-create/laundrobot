const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const axios = require('axios');

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode address via Nominatim (proxied so User-Agent is set server-side)
router.get('/geocode', auth, async (req, res) => {
  const { address } = req.query;
  if (!address?.trim()) return res.status(400).json({ error: 'address required' });
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: address.trim() + ', Philippines', format: 'json', limit: 1 },
      headers: { 'User-Agent': 'LaundroBot/1.0 (laundrobot@thelaundryproject.ph)' },
      timeout: 8000,
    });
    if (!data.length) return res.json(null);
    res.json({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Save shop location + delivery settings
router.put('/shop-location', auth, async (req, res) => {
  const { shop_address, shop_lat, shop_lng, delivery_note, delivery_radius } = req.body;
  try {
    await db.query(
      `UPDATE tenants SET shop_address=$1, shop_lat=$2, shop_lng=$3, delivery_note=$4, delivery_radius=$5 WHERE id=$6`,
      [shop_address || null, shop_lat || null, shop_lng || null, delivery_note || null, delivery_radius || 15, req.user.tenant_id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET shop location + brackets
router.get('/', auth, async (req, res) => {
  try {
    const [{ rows: brackets }, { rows: [tenant] }] = await Promise.all([
      db.query('SELECT * FROM delivery_brackets WHERE tenant_id=$1 ORDER BY min_km ASC', [req.user.tenant_id]),
      db.query('SELECT shop_address, shop_lat, shop_lng, delivery_note, delivery_radius FROM tenants WHERE id=$1', [req.user.tenant_id]),
    ]);
    res.json({ brackets, ...tenant });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST bracket
router.post('/', auth, async (req, res) => {
  const { min_km, max_km, fee, sort_order = 0 } = req.body;
  try {
    const { rows } = await db.query(
      'INSERT INTO delivery_brackets (tenant_id, min_km, max_km, fee, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.tenant_id, min_km, max_km, fee, sort_order]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT bracket
router.put('/:id', auth, async (req, res) => {
  const { min_km, max_km, fee, sort_order } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE delivery_brackets SET min_km=$1, max_km=$2, fee=$3, sort_order=$4 WHERE id=$5 AND tenant_id=$6 RETURNING *',
      [min_km, max_km, fee, sort_order ?? 0, req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE bracket
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM delivery_brackets WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.haversine = haversine;
