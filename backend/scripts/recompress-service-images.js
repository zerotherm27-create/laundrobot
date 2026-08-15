#!/usr/bin/env node
'use strict';

// ── Recompress service images ────────────────────────────────────────────────
// services.image_url stores raw base64 data URIs (no external storage/CDN —
// see Services.jsx's upload handler). Shops that upload full-size phone photos
// bloat the public /:tenantId/bootstrap payload — 10MB+ for THE LAUNDRY PROJECT's
// 47 services, which is the primary cause of a slow-loading public booking page.
// New uploads are now compressed client-side (Services.jsx compressImage()); this
// script backfills existing rows to match (max 800px on the long edge, JPEG q=0.72).
//
// Backs up every row's original image_url (as-is) to a timestamped JSON file
// before overwriting anything, since compression is lossy and not reversible
// otherwise. Skips rows already small enough that recompressing wouldn't help,
// and de-dupes identical source images so repeated bytes are only processed once.
//
//   Run:  node scripts/recompress-service-images.js <tenant_id> [--dry-run]

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const db = require('../db');

// node-postgres crashes the whole process on an unhandled pool-level 'error'
// event from an idle client — e.g. the pooler dropping a connection while
// sharp is busy resizing between queries. This script runs long CPU-bound
// gaps between DB round-trips, so swallow those instead of crashing mid-run.
db.pool.on('error', err => console.warn('[pool] idle client error (ignored):', err.message));

const MAX_DIM     = 800;
const JPEG_QUALITY = 72;
const SKIP_UNDER_BYTES = 60 * 1024; // don't bother recompressing already-small images

async function main() {
  const tenantId = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!tenantId) {
    console.error('Usage: node scripts/recompress-service-images.js <tenant_id> [--dry-run]');
    process.exit(1);
  }

  const { rows: services } = await db.query(
    `SELECT id, name, image_url FROM services WHERE tenant_id=$1 AND image_url IS NOT NULL AND image_url LIKE 'data:image/%'`,
    [tenantId]
  );
  if (!services.length) {
    console.log('No base64 image_url rows found for this tenant.');
    return db.pool.end();
  }

  const backupPath = path.join(__dirname, `image-backup-${tenantId}-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(services, null, 2));
  console.log(`Backed up ${services.length} original image_url values to ${backupPath}`);

  const cache = new Map(); // content hash → compressed data URL, to skip recompressing duplicate images
  let totalBefore = 0, totalAfter = 0, skipped = 0, updated = 0;

  for (const svc of services) {
    const beforeLen = svc.image_url.length;
    totalBefore += beforeLen;

    if (beforeLen < SKIP_UNDER_BYTES) {
      totalAfter += beforeLen;
      skipped++;
      continue;
    }

    const hash = crypto.createHash('sha1').update(svc.image_url).digest('hex');
    let compressed = cache.get(hash);
    if (!compressed) {
      const base64 = svc.image_url.slice(svc.image_url.indexOf(',') + 1);
      const buf = Buffer.from(base64, 'base64');
      const outBuf = await sharp(buf)
        .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
      compressed = `data:image/jpeg;base64,${outBuf.toString('base64')}`;
      cache.set(hash, compressed);
    }

    totalAfter += compressed.length;
    updated++;
    console.log(`  ${svc.name.trim()}: ${(beforeLen / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB`);

    if (!dryRun) {
      await db.query('UPDATE services SET image_url=$1 WHERE id=$2', [compressed, svc.id]);
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] Would update' : 'Updated'} ${updated} rows, skipped ${skipped} already-small rows.`);
  console.log(`Total base64 size: ${(totalBefore / 1024 / 1024).toFixed(2)}MB → ${(totalAfter / 1024 / 1024).toFixed(2)}MB`);
  await db.pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
