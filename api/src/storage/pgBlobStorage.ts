/**
 * Phase 1 storage: BYTEA columns in tbl_attachment_blob.
 *
 * Pros: no extra infrastructure, no third-party config, just works
 * out of the box on Postgres.
 *
 * Cons: makes the DB bigger; pg_dump grows with files; no CDN.
 * Acceptable for a small nonprofit with files <10MB each and
 * maybe a few hundred MB total. Migrate to object storage when
 * either bound starts to bite.
 */

import { query, queryOne } from '../db/pool.js';
import type { StorageProvider } from './types.js';

export const pgBlobStorage: StorageProvider = {
  name: 'pg_blob',

  async put({ bytes }) {
    const row = await queryOne<{ blob_id: number }>(
      `INSERT INTO tbl_attachment_blob (content) VALUES ($1) RETURNING blob_id`,
      [bytes],
    );
    if (!row) throw new Error('Failed to persist blob');
    return { ref: String(row.blob_id) };
  },

  async get(ref) {
    const id = Number(ref);
    if (!Number.isInteger(id) || id <= 0) throw new Error(`Invalid pg_blob ref: ${ref}`);
    const row = await queryOne<{ content: Buffer }>(
      `SELECT content FROM tbl_attachment_blob WHERE blob_id = $1`,
      [id],
    );
    if (!row) throw new Error(`Blob ${ref} not found`);
    return row.content;
  },

  async delete(ref) {
    const id = Number(ref);
    if (!Number.isInteger(id) || id <= 0) return;     // idempotent on bad refs
    await query(`DELETE FROM tbl_attachment_blob WHERE blob_id = $1`, [id]);
  },

  async info(ref) {
    const id = Number(ref);
    if (!Number.isInteger(id) || id <= 0) return null;
    const row = await queryOne<{ size_bytes: string }>(
      `SELECT OCTET_LENGTH(content)::text AS size_bytes FROM tbl_attachment_blob WHERE blob_id = $1`,
      [id],
    );
    return row ? { sizeBytes: Number(row.size_bytes) } : null;
  },
};
