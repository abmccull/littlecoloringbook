#!/usr/bin/env node
// Clear all customer-submission test data from the DB.
//
// Preserves the before/after creative pool (source photos + generated
// coloring pages) by detaching them from their parent order before the
// cascade delete fires.
//
// Usage:
//   # dry-run — prints pre-counts, makes no changes
//   node --env-file=.env.local scripts/clear-customer-data.mjs
//
//   # execute — requires CONFIRM=wipe-customer-data
//   CONFIRM=wipe-customer-data node --env-file=.env.local scripts/clear-customer-data.mjs
//
// See plan at C:\Users\hands\.claude\plans\curious-rolling-cocke.md

import { getSqlClient } from "./lib/migrate-runner.mjs";

const CONFIRM_VALUE = "wipe-customer-data";

// Tables emptied via explicit DELETE in FK-safe order.
const DELETE_TABLES = [
  "refunds",            // RESTRICTs orders — must go first
  "email_sends",
  "email_events",
  "broadcast_sends",
  "email_sequence_states",
  "stripe_webhook_events",
  "dm_messages",
  "dm_threads",
  "processing_jobs",
  "capi_events",
  "kling_usage",
  "orders",             // cascades to order_addresses, portal_tokens, non-detached uploads/assets,
                        //   generation_jobs→generation_pages, shipping_quotes, fulfillment_jobs,
                        //   support_actions, order_events
  "customers",          // cascades to customer_user_links, tickets→ticket_messages
];

// Tables that cascade-die automatically when their parent goes.
const CASCADE_TABLES = [
  "order_addresses",
  "portal_tokens",
  "generation_jobs",
  "generation_pages",
  "shipping_quotes",
  "fulfillment_jobs",
  "support_actions",
  "order_events",
  "customer_user_links",
  "tickets",
  "ticket_messages",
];

// These assets/uploads kinds are detached (order_id → null) before the orders
// delete, so the rows + GCS blobs survive as a standalone before/after pool.
const PRESERVED_UPLOADS_KINDS = ["original"];
const PRESERVED_ASSETS_KINDS = ["normalized", "generated_page", "preview"];

async function count(sql, table, whereClause = "") {
  const q = `SELECT COUNT(*)::int AS n FROM ${table}${whereClause ? ` WHERE ${whereClause}` : ""}`;
  const rows = await sql.query(q);
  return rows[0]?.n ?? 0;
}

async function snapshot(sql, label) {
  console.log(`\n— ${label} —`);

  console.log("\nTables to be emptied (explicit DELETE):");
  let deleteTotal = 0;
  for (const table of DELETE_TABLES) {
    const n = await count(sql, table);
    deleteTotal += n;
    console.log(`  ${table.padEnd(28)} ${n}`);
  }
  console.log(`  ${"TOTAL".padEnd(28)} ${deleteTotal}`);

  console.log("\nTables cascade-emptied via orders/customers:");
  let cascadeTotal = 0;
  for (const table of CASCADE_TABLES) {
    const n = await count(sql, table);
    cascadeTotal += n;
    console.log(`  ${table.padEnd(28)} ${n}`);
  }
  console.log(`  ${"TOTAL".padEnd(28)} ${cascadeTotal}`);

  const preservedUploads = await count(
    sql,
    "uploads",
    `kind IN ('${PRESERVED_UPLOADS_KINDS.join("','")}')`,
  );
  const preservedAssets = await count(
    sql,
    "assets",
    `kind IN ('${PRESERVED_ASSETS_KINDS.join("','")}')`,
  );
  const detachedUploads = await count(
    sql,
    "uploads",
    `kind IN ('${PRESERVED_UPLOADS_KINDS.join("','")}') AND order_id IS NULL`,
  );
  const detachedAssets = await count(
    sql,
    "assets",
    `kind IN ('${PRESERVED_ASSETS_KINDS.join("','")}') AND order_id IS NULL`,
  );

  console.log("\nPreserved creative pool (before/after pairs):");
  console.log(`  uploads kind IN (${PRESERVED_UPLOADS_KINDS.join(",")}): ${preservedUploads} (already detached: ${detachedUploads})`);
  console.log(`  assets  kind IN (${PRESERVED_ASSETS_KINDS.join(",")}): ${preservedAssets} (already detached: ${detachedAssets})`);

  const otherAssets = await count(sql, "assets", `kind NOT IN ('${PRESERVED_ASSETS_KINDS.join("','")}')`);
  const otherUploads = await count(sql, "uploads", `kind NOT IN ('${PRESERVED_UPLOADS_KINDS.join("','")}')`);
  console.log("\nTo be cascade-deleted with orders:");
  console.log(`  uploads kind NOT IN (${PRESERVED_UPLOADS_KINDS.join(",")}): ${otherUploads}`);
  console.log(`  assets  kind NOT IN (${PRESERVED_ASSETS_KINDS.join(",")}): ${otherAssets}`);

  return {
    deleteTotal,
    cascadeTotal,
    preservedUploads,
    preservedAssets,
    detachedUploads,
    detachedAssets,
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`\n✗ Assertion failed: ${message}`);
    process.exit(2);
  }
}

async function main() {
  const sql = getSqlClient();
  const confirm = process.env.CONFIRM;
  const executing = confirm === CONFIRM_VALUE;

  console.log(`Clear customer test data ${executing ? "(EXECUTING)" : "(DRY RUN)"}`);

  const before = await snapshot(sql, "BEFORE");

  if (!executing) {
    console.log(`\nDry run complete. To execute, re-run with:`);
    console.log(`  CONFIRM=${CONFIRM_VALUE} node --env-file=.env.local scripts/clear-customer-data.mjs`);
    process.exit(0);
  }

  console.log("\n— EXECUTING —");
  const startedAt = Date.now();

  await sql.transaction([
    sql`DELETE FROM refunds`,
    sql`DELETE FROM email_sends`,
    sql`DELETE FROM email_events`,
    sql`DELETE FROM broadcast_sends`,
    sql`DELETE FROM email_sequence_states`,
    sql`DELETE FROM stripe_webhook_events`,
    sql`DELETE FROM dm_messages`,
    sql`DELETE FROM dm_threads`,
    sql`DELETE FROM processing_jobs`,
    sql`DELETE FROM capi_events`,
    sql`DELETE FROM kling_usage`,
    sql`UPDATE uploads SET order_id = NULL WHERE kind = 'original'`,
    sql`UPDATE assets  SET order_id = NULL WHERE kind IN ('normalized', 'generated_page', 'preview')`,
    sql`DELETE FROM orders`,
    sql`DELETE FROM customers`,
  ]);

  const durationMs = Date.now() - startedAt;
  console.log(`Transaction committed in ${durationMs}ms.`);

  const after = await snapshot(sql, "AFTER");

  console.log("\n— ASSERTIONS —");
  assert(after.deleteTotal === 0, `explicit-delete tables still have ${after.deleteTotal} row(s)`);
  assert(after.cascadeTotal === 0, `cascade tables still have ${after.cascadeTotal} row(s)`);

  const orphanUploads = await count(sql, "uploads", "order_id IS NOT NULL");
  const orphanAssets = await count(sql, "assets", "order_id IS NOT NULL");
  assert(orphanUploads === 0, `${orphanUploads} upload row(s) still attached to an order`);
  assert(orphanAssets === 0, `${orphanAssets} asset row(s) still attached to an order`);

  assert(
    after.preservedUploads === before.preservedUploads,
    `preserved uploads count changed (${before.preservedUploads} → ${after.preservedUploads})`,
  );
  assert(
    after.preservedAssets === before.preservedAssets,
    `preserved assets count changed (${before.preservedAssets} → ${after.preservedAssets})`,
  );

  console.log("✓ All assertions passed. Customer test data cleared; before/after pool intact.");
}

main().catch((err) => {
  console.error("\n✗ Script failed:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
