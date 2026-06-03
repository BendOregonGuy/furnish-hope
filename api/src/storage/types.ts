/**
 * Pluggable storage provider interface. Phase 1 ships PgBlobStorage
 * (writes BYTEA into tbl_attachment_blob). Future providers — DO
 * Spaces, S3, Google Drive — implement the same interface and the
 * factory in ./index.ts resolves them by name.
 *
 * Provider implementations MUST be pure I/O: no metadata coupling,
 * no per-entity logic. The attachments route handles tbl_entity_attachment
 * inserts/updates; this interface just moves bytes around.
 */

export interface StorageProvider {
  /** Stable string id used in tbl_entity_attachment.storage_provider. */
  readonly name: string;

  /**
   * Store `bytes` and return an opaque reference that the same
   * provider can use later to read or delete the object. The shape
   * of the ref is up to the provider (blob_id, S3 key, Drive file id).
   */
  put(args: { bytes: Buffer; mimeType: string; filename: string }): Promise<{ ref: string }>;

  /** Read bytes back. */
  get(ref: string): Promise<Buffer>;

  /** Remove the underlying object. Idempotent: a missing object is not an error. */
  delete(ref: string): Promise<void>;

  /** Tags any provider-specific extras (CDN URL, share link). Optional. */
  info?(ref: string): Promise<{ externalUrl?: string; sizeBytes?: number } | null>;
}
