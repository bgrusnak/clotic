// src/db.ts
import { MessageRecord, FileRecord } from "./types";

export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Inserts a new message record into the "messages" table.
   * Returns an object containing the last inserted row ID.
   */
  async insertMessage(message: MessageRecord): Promise<{ lastRowId: number }> {
    const query = `
      INSERT INTO messages (chatId, chatType, userId, content, mediaType, fileReference, processed, attempts, processingDate, createdAt, prepared)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await this.db.prepare(query)
      .bind(
        message.chatId,
        message.chatType,
        message.userId,
        message.content,
        message.mediaType,
        message.fileReference || null,
        message.processed ? 1 : 0,
        message.attempts,
        message.processingDate,
        message.createdAt,
        message.prepared ? 1 : 0
      ).run();
    return { lastRowId: result.meta.last_row_id };
  }

  /**
   * Updates a message's content by prepending a prefix to the existing content
   * and marks the message as prepared.
   *
   * @param id - The message ID.
   * @param prefix - The prefix to prepend.
   */
  async prependMessageContentAndMarkPrepared(id: number, prefix: string): Promise<void> {
    const query = `UPDATE messages SET content = ? || content, prepared = 1 WHERE id = ?`;
    await this.db.prepare(query).bind(prefix, id).run();
  }

  /**
   * Retrieves unprocessed messages that are scheduled for processing and are prepared.
   *
   * @param currentTime - The current timestamp.
   * @param limit - The maximum number of messages to retrieve.
   * @returns An array of message records.
   */
  async getUnprocessedMessages(currentTime: number, limit: number): Promise<MessageRecord[]> {
    const query = `
      SELECT * FROM messages 
      WHERE processed = 0 AND prepared = 1 AND processingDate <= ? 
      ORDER BY processingDate ASC
      LIMIT ?
    `;
    const result = await this.db.prepare(query).bind(currentTime, limit).all<MessageRecord>();
    return result.results || [];
  }

  /**
   * Retrieves additional unprocessed (prepared) messages, excluding certain IDs.
   */
  async getUnprocessedMessagesExcluding(currentTime: number, excludedIds: number[], limit: number): Promise<MessageRecord[]> {
    let query = `
      SELECT * FROM messages 
      WHERE processed = 0 AND prepared = 1 AND processingDate <= ? 
    `;
    if (excludedIds.length > 0) {
      const placeholders = excludedIds.map(() => '?').join(',');
      query += ` AND id NOT IN (${placeholders}) `;
    }
    query += ` ORDER BY processingDate ASC LIMIT ?`;
    const params = [currentTime, ...excludedIds, limit];
    const result = await this.db.prepare(query).bind(...params).all<MessageRecord>();
    return result.results || [];
  }

  /**
   * Marks a message as processed.
   */
  async markMessageProcessed(id: number): Promise<void> {
    const query = `UPDATE messages SET processed = 1 WHERE id = ?`;
    await this.db.prepare(query).bind(id).run();
  }

  /**
   * Updates a message for a retry attempt.
   */
  async updateMessageRetry(id: number, attempts: number, newProcessingDate: number): Promise<void> {
    const query = `UPDATE messages SET attempts = ?, processingDate = ? WHERE id = ?`;
    await this.db.prepare(query).bind(attempts, newProcessingDate, id).run();
  }


  /**
 * Updates only the processing date of a message record, which is useful for deferring its processing.
 * @param id - The unique identifier of the message.
 * @param newProcessingDate - The new timestamp when the message should be processed.
 */
  async updateMessageProcessingDate(id: number, newProcessingDate: number): Promise<void> {
    const query = `UPDATE messages SET processingDate = ? WHERE id = ?`;
    await this.db.prepare(query).bind(newProcessingDate, id).run();
  }

  /**
   * Retrieves a file record by its Telegram file ID.
   */
  async getFileRecordByTelegramId(telegramFileId: string): Promise<any> {
    const query = `SELECT * FROM file_identifiers WHERE telegramFileId = ? LIMIT 1`;
    const result = await this.db.prepare(query).bind(telegramFileId).first<any>();
    return result || null;
  }

  /**
   * Inserts a new file record.
   */
  async insertFileRecord(record: { telegramFileId: string | null, r2Key: string, createdAt: number }): Promise<void> {
    const query = `
      INSERT INTO file_identifiers (telegramFileId, r2Key, createdAt)
      VALUES (?, ?, ?)
    `;
    await this.db.prepare(query)
      .bind(record.telegramFileId, record.r2Key, record.createdAt)
      .run();
  }

  /**
 * Updates the Telegram file ID in an existing file record, typically after successfully sending the file via the Telegram API.
 * @param r2Key - The R2 storage key associated with the file record.
 * @param telegramFileId - The new Telegram file ID to update the record with.
 */
  async updateFileRecordTelegramId(r2Key: string, telegramFileId: string): Promise<void> {
    const query = `UPDATE file_identifiers SET telegramFileId = ? WHERE r2Key = ?`;
    await this.db.prepare(query).bind(telegramFileId, r2Key).run();
  }

    /**
   * Retrieves a file record from the "file_identifiers" table based on the provided R2 storage key.
   * @param r2Key - The key used to store the file in the R2 (R2Bucket) storage.
   * @returns The file record if found, otherwise null.
   */
    async getFileRecordByR2Key(r2Key: string): Promise<FileRecord | null> {
      const query = `SELECT * FROM file_identifiers WHERE r2Key = ? LIMIT 1`;
      const result = await this.db.prepare(query).bind(r2Key).first<FileRecord>();
      return result || null;
    }
}


