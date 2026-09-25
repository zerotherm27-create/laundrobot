const db = require('../db');

// Records a superadmin action. It must NEVER break the request it describes: if the table has not been
// created yet (see db/migrations/2026-09-27-superadmin-audit-log.sql) or the insert fails, log and move on.
// `detail` must never contain secrets — pass field NAMES that changed, not values.
async function logSuperadminAction(req, action, { tenantId = null, detail = null } = {}) {
  try {
    if (req.user?.role !== 'superadmin') return;
    await db.query(
      `INSERT INTO superadmin_audit_log (actor_user_id, actor_email, action, target_tenant_id, detail, ip)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id || null, req.user.email || null, action, tenantId, detail ? JSON.stringify(detail) : null, req.ip || null]
    );
  } catch (e) {
    console.warn('[audit] could not record superadmin action', action, '-', e.message);
  }
}

module.exports = { logSuperadminAction };
