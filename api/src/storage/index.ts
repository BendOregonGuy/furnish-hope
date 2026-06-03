/**
 * Storage provider factory. Resolves a provider by name and returns
 * the implementation. New providers register themselves by adding a
 * branch here.
 *
 * The default provider for new uploads is controlled by the
 * `attachment_storage_provider` app setting; uploads without an
 * explicit provider go through `getDefaultProvider()`.
 */

import { queryOne } from '../db/pool.js';
import type { StorageProvider } from './types.js';
import { pgBlobStorage } from './pgBlobStorage.js';

export type { StorageProvider } from './types.js';

/** Known providers. Add new entries as we implement them. */
const PROVIDERS: Record<string, StorageProvider> = {
  pg_blob: pgBlobStorage,
  // Future:
  //   do_spaces: doSpacesStorage,
  //   s3:        s3Storage,
  //   gdrive:    googleDriveStorage,
};

/** Resolve a provider by its stored name. Throws if unknown so a
 *  corrupt row can't silently lose data. */
export function getProvider(name: string): StorageProvider {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Unknown storage provider: ${name}`);
  return p;
}

/**
 * Provider used for new uploads. Reads the org setting; falls back to
 * pg_blob if unset. The admin "Storage" page is the place to change
 * this (Phase 2 work).
 */
export async function getDefaultProvider(): Promise<StorageProvider> {
  const row = await queryOne<{ setting_value: string }>(
    `SELECT setting_value FROM tbl_app_setting WHERE setting_key = 'attachment_storage_provider'`,
  );
  const name = row?.setting_value?.trim() || 'pg_blob';
  return getProvider(name);
}

/** All providers we know about — for the admin migration page. */
export function listProviders(): Array<{ name: string; configured: boolean; description: string }> {
  return [
    { name: 'pg_blob',   configured: true,  description: 'Postgres BYTEA columns. Phase 1 default. No infra.' },
    { name: 'do_spaces', configured: false, description: 'DigitalOcean Spaces (S3-compatible). Future provider.' },
    { name: 's3',        configured: false, description: 'Amazon S3 or any S3-compatible object store. Future.' },
    { name: 'gdrive',    configured: false, description: 'Google Drive Shared Drive via service account. Future.' },
  ];
}
