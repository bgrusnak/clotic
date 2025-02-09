// src/telegram.ts
// This file implements the TelegramClient class which handles sending messages via the Telegram API.
// It supports sending text messages as well as media messages (e.g., photos) using different methods such as sending by file ID, URL, or multipart/form-data.

import { Env, TelegramResponse, MessageRecord, FileRecord } from "./types";
import { getConfig } from "./config";
import { Database } from "./db";
import { StorageHelper } from "./storage";
/**
 * Interface representing the result of a Telegram message sending attempt.
 */
export interface TelegramSendResult {
  success: boolean; // Indicates if the message was sent successfully.
  newFileId?: string; // If applicable, the new file ID returned by Telegram after sending a media file.
  response?: any; // The complete response received from the Telegram API.
}

export class TelegramClient {
  private config: ReturnType<typeof getConfig>;
  private env: Env;
  private db: Database;
  private storage: StorageHelper;

  /**
   * Constructs a new TelegramClient instance.
   * @param env - The environment bindings containing configuration variables.
   * @param db - The Database instance for database operations.
   * @param storage - The StorageHelper instance for file storage operations.
   */
  constructor(env: Env, db: Database, storage: StorageHelper) {
    this.env = env;
    this.config = getConfig(env);
    this.db = db;
    this.storage = storage;
  }

  /**
   * Sends a text message via the Telegram API.
   * @param message - The message record containing details such as chat ID and content.
   * @returns An object indicating the success of the operation and the API response.
   */
  async sendTextMessage(message: MessageRecord): Promise<TelegramSendResult> {
    const url = `${this.config.TELEGRAM_API_URL}/bot${this.config.TELEGRAM_API_TOKEN}/sendMessage`;
    const payload = {
      chat_id: message.chatId,
      text: message.content,
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: TelegramResponse = await res.json();
      return { success: data.ok, response: data };
    } catch (err) {
      return { success: false };
    }
  }

  /**
   * Sends a photo message via the Telegram API.
   * The method determines whether to send the photo using a Telegram file_id, via a URL, or as a multipart form if the file needs to be uploaded.
   * @param message - The message record containing details such as chat ID, caption, and file reference.
   * @returns An object indicating the success of the operation and the API response.
   */
  async sendPhotoMessage(message: MessageRecord): Promise<TelegramSendResult> {
    const chatId = message.chatId;
    const caption = message.content;
    let photo: string | Blob;
    // First, attempt to retrieve the file record using the Telegram file_id from the fileReference.
    const fileRecordByTg = await this.db.getFileRecordByTelegramId(message.fileReference!);
    if (fileRecordByTg && fileRecordByTg.telegramFileId) {
      // If the file is already known to Telegram, send it using its file_id.
      photo = fileRecordByTg.telegramFileId;
      return await this.sendPhotoByFileId(chatId, photo as string, caption);
    }
    // If no record is found by Telegram file_id, try to find it by the R2 storage key.
    const fileRecordByR2 = await this.db.getFileRecordByR2Key(message.fileReference!);
    if (fileRecordByR2) {
      if (fileRecordByR2.telegramFileId) {
        // If the file record has been updated with a Telegram file_id, send it using that file_id.
        photo = fileRecordByR2.telegramFileId;
        return await this.sendPhotoByFileId(chatId, photo as string, caption);
      } else {
        // Otherwise, attempt to send the file as a multipart form (uploading the file content).
        const fileBlob = await this.storage.getFile(fileRecordByR2.r2Key);
        if (!fileBlob) {
          // If the file does not exist in storage, treat the fileReference as a URL and send the photo accordingly.
          photo = message.fileReference!;
          return await this.sendPhotoByUrl(chatId, photo, caption);
        } else {
          return await this.sendPhotoMultipart(chatId, fileBlob, caption, fileRecordByR2.r2Key);
        }
      }
    }
    // If no file record is found by either method, treat the fileReference as a URL.
    photo = message.fileReference!;
    return await this.sendPhotoByUrl(chatId, photo, caption);
  }

  /**
   * Sends a photo message using a Telegram file_id.
   * @param chatId - The chat identifier where the message should be sent.
   * @param fileId - The Telegram file_id of the photo.
   * @param caption - The caption for the photo message.
   * @returns An object indicating the success of the operation and the API response.
   */
  async sendPhotoByFileId(chatId: string, fileId: string, caption: string): Promise<TelegramSendResult> {
    const url = `${this.config.TELEGRAM_API_URL}/bot${this.config.TELEGRAM_API_TOKEN}/sendPhoto`;
    const payload = {
      chat_id: chatId,
      photo: fileId,
      caption: caption,
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: TelegramResponse = await res.json();
      return { success: data.ok, response: data };
    } catch (err) {
      return { success: false };
    }
  }

  /**
   * Sends a photo message using a URL.
   * @param chatId - The chat identifier where the message should be sent.
   * @param urlPhoto - The URL of the photo to send.
   * @param caption - The caption for the photo message.
   * @returns An object indicating the success of the operation and the API response.
   */
  async sendPhotoByUrl(chatId: string, urlPhoto: string, caption: string): Promise<TelegramSendResult> {
    const url = `${this.config.TELEGRAM_API_URL}/bot${this.config.TELEGRAM_API_TOKEN}/sendPhoto`;
    const payload = {
      chat_id: chatId,
      photo: urlPhoto,
      caption: caption,
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: TelegramResponse = await res.json();
      return { success: data.ok, response: data };
    } catch (err) {
      return { success: false };
    }
  }

  /**
   * Sends a photo message using multipart/form-data to upload the file buffer.
   * This method is used when the file is stored in the R2 storage and must be uploaded directly.
   * @param chatId - The chat identifier where the message should be sent.
   * @param fileBlob - The Blob containing the photo data.
   * @param caption - The caption for the photo message.
   * @param r2Key - The key used to reference the file in R2 storage.
   * @returns An object indicating the success of the operation and the API response. If successful,
   *          it also updates the file record with the new Telegram file_id.
   */
  async sendPhotoMultipart(chatId: string, fileBlob: Blob, caption: string, r2Key: string): Promise<TelegramSendResult> {
    const url = `${this.config.TELEGRAM_API_URL}/bot${this.config.TELEGRAM_API_TOKEN}/sendPhoto`;
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("caption", caption);
    // Append the file to the form data under the field "photo".
    formData.append("photo", fileBlob, "file.jpg");
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      const data: TelegramResponse = await res.json();
      // If the upload is successful, extract the new Telegram file_id from the response and update the database record.
      if (data.ok && data.result && data.result.photo && data.result.photo.length > 0) {
        // Choose the last element from the photo array, which usually represents the highest quality image.
        const photos = data.result.photo;
        const newFileId = photos[photos.length - 1].file_id;
        await this.db.updateFileRecordTelegramId(r2Key, newFileId);
        return { success: true, newFileId, response: data };
      }
      return { success: data.ok, response: data };
    } catch (err) {
      return { success: false };
    }
  }

  /**
   * Determines the method to send a message based on its media type.
   * For text messages, it calls the sendTextMessage method.
   * For photo messages, it calls the sendPhotoMessage method.
   * Additional media types (e.g., video, document) can be implemented similarly.
   * @param message - The message record containing details about the message to be sent.
   * @returns An object indicating the success of the operation and the API response.
   */
  async sendMessage(message: MessageRecord): Promise<TelegramSendResult> {
    if (message.mediaType === "text") {
      return await this.sendTextMessage(message);
    } else if (message.mediaType === "photo") {
      return await this.sendPhotoMessage(message);
    }
    // Additional media types (video, document, etc.) can be handled here.
    else {
      // By default, fall back to sending a text message.
      return await this.sendTextMessage(message);
    }
  }

}
