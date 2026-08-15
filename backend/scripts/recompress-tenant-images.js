#!/usr/bin/env node
'use strict';

// ── Recompress tenant logo / payment QR images ──────────────────────────────
// Same issue as recompress-service-images.js: tenants.logo_url, qr_image_url,
// and maya_qr_url store raw base64 with no external storage/CDN, and uploads
// (Settings.jsx) were unresized. logo_url gets JPEG-compressed like a normal
// photo. QR codes keep their original format (many are already-lossy JPEG
// screenshots — re-encoding those as "lossless" PNG doesn't help, since PNG
// can't cleanly compress JPEG noise, and can end up larger) at a higher
// quality tier than photos, so module contrast stays sharp enough to scan.
//
// Backs up the tenant's original values to a timestamped JSON file first.
//
//   Run:  node scripts/recompress-tenant-images.js <tenant_id> [--dry-run]

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const db = require('../db');

db.pool.on('error', err => console.warn('[pool] idle client error (ignored):', err.message));

const MAX_DIM = 800;
const QR_MAX_DIM = 500; // QR codes scan reliably at far lower resolution than photos
const PHOTO_QUALITY = 72;
const QR_JPEG_QUALITY = 88; // higher fidelity than photos — protects module contrast
const SKIP_UNDER_BYTES = 60 * 1024;

async function recompressOne(dataUrl, { isQr }) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const buf = Buffer.from(base64, 'base64');
  const img = sharp(buf);
  const meta = await img.metadata();
  const isSourcePng = meta.format === 'png';
  const maxDim = isQr ? QR_MAX_DIM : MAX_DIM;

  let pipeline = img.resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
  pipeline = (isQr && isSourcePng)
    ? pipeline.png({ compressionLevel: 9 })
    : pipeline.jpeg({ quality: isQr ? QR_JPEG_QUALITY : PHOTO_QUALITY });
  const outBuf = await pipeline.toBuffer();
  const outFormat = (isQr && isSourcePng) ? 'png' : 'jpeg';
  return `data:image/${outFormat};base64,${outBuf.toString('base64')}`;
}

async function main() {
  const tenantId = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!tenantId) {
    console.error('Usage: node scripts/recompress-tenant-images.js <tenant_id> [--dry-run]');
    process.exit(1);
  }

  const { rows: [tenant] } = await db.query(
    `SELECT id, name, logo_url, qr_image_url, maya_qr_url FROM tenants WHERE id=$1`, [tenantId]
  );
  if (!tenant) { console.error('Tenant not found.'); process.exit(1); }

  const backupPath = path.join(__dirname, `tenant-image-backup-${tenantId}-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(tenant, null, 2));
  console.log(`Backed up original values to ${backupPath}`);

  const updates = {};
  const fields = [
    { col: 'logo_url',     isQr: false },
    { col: 'qr_image_url', isQr: true },
    { col: 'maya_qr_url',  isQr: true },
  ];

  for (const { col, isQr } of fields) {
    const val = tenant[col];
    if (!val || !val.startsWith('data:image/')) continue;
    if (val.length < SKIP_UNDER_BYTES) { console.log(`  ${col}: ${(val.length/1024).toFixed(0)}KB — already small, skipping`); continue; }
    const compressed = await recompressOne(val, { isQr });
    if (compressed.length >= val.length) { console.log(`  ${col}: ${(val.length/1024).toFixed(0)}KB — recompression didn't help, leaving as-is`); continue; }
    console.log(`  ${col}: ${(val.length/1024).toFixed(0)}KB → ${(compressed.length/1024).toFixed(0)}KB`);
    updates[col] = compressed;
  }

  if (!Object.keys(updates).length) { console.log('Nothing to update.'); return db.pool.end(); }

  if (!dryRun) {
    const setClauses = Object.keys(updates).map((col, i) => `${col}=$${i + 1}`).join(', ');
    await db.query(`UPDATE tenants SET ${setClauses} WHERE id=$${Object.keys(updates).length + 1}`,
      [...Object.values(updates), tenantId]);
    console.log('Updated.');
  } else {
    console.log('[DRY RUN] Would update the above fields.');
  }
  await db.pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
