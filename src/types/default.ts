// src/types.ts

/**
 * Defines the supported media types for messages.
 */
export type MediaType = "text" | "photo" | "video" | "document" | "audio" | "sticker";

/**
 * Represents a record for a message stored in the database.
 */
export interface MessageRecord {
  id?: number; // Assigned by the database.
  chatId: string;
  chatType: "private" | "group" | "supergroup" | "channel";
  userId: string;
  content: string;
  mediaType: MediaType;
  fileReference?: string; // Could be a Telegram file_id, an R2 key, or a URL.
  processed: boolean;
  attempts: number;
  processingDate: number; // Timestamp when the message should be processed.
  createdAt: number;
  prepared: boolean; // New flag; false on insert, set to true after follow‑up processing.
}

/**
 * Simplified interface representing the response structure from the Telegram API.
 */
export interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
}

/**
 * Interface representing the environment bindings (e.g., variables and external resources).
 */
export interface Env {
  D1_DB: D1Database;
  R2_BUCKET: R2Bucket;
  TELEGRAM_API_TOKEN: string;
  TELEGRAM_API_URL: string;
  RATE_LIMIT_PRIVATE: string;
  RATE_LIMIT_CHANNEL: string;
  RATE_LIMIT_GLOBAL: string;
  DEV?: string;
  DOMAIN?: string;
}

/**
 * Represents a record for a file stored in the database.
 */
export interface FileRecord {
  telegramFileId: string | null; // The file identifier provided by Telegram, may be null if not yet obtained.
  r2Key: string; // The key under which the file is stored in the R2 (R2Bucket) storage.
  createdAt: number; // Timestamp when the file record was created.
}