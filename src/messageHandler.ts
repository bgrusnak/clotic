// src/messageHandler.ts
import { Env, MessageRecord } from "./types";
import { Database } from "./db";
import { StorageHelper } from "./storage";
import { getConfig } from "./config";

/**
 * Handles an incoming HTTP request containing a Telegram update.
 * Saves the message into the database and returns an object containing the HTTP Response and the inserted message ID.
 *
 * @param request - The incoming HTTP request.
 * @param env - The environment bindings.
 * @returns An object with "response" (HTTP Response) and "messageId" (number).
 */
export async function handleIncomingMessage(
  request: Request,
  env: Env
): Promise<{ response: Response; messageId: number }> {
  try {
    const data = await request.json() as any;
    if (!data.message) {
      return { response: new Response("No message field", { status: 400 }), messageId: 0 };
    }
    const msg = data.message;
    const db = new Database(env.D1_DB);
    const storage = new StorageHelper(env.R1_BUCKET);
    const config = getConfig(env);

    const now = Date.now();

    const chatId = msg.chat.id.toString();
    const chatType = msg.chat.type;
    const userId = msg.from ? msg.from.id.toString() : "";
    let text = "";
    let mediaType: "text" | "photo" | "video" | "document" = "text";
    let fileReference: string | undefined = undefined;

    if (msg.text) {
      text = msg.text;
      mediaType = "text";
    } else if (msg.photo) {
      const photoArray = msg.photo;
      const photoObj = photoArray[photoArray.length - 1];
      fileReference = photoObj.file_id;
      text = msg.caption || "";
      mediaType = "photo";

      const existingFile = await db.getFileRecordByTelegramId(fileReference!);
      if (!existingFile) {
        const getFileUrl = `${config.TELEGRAM_API_URL}/bot${config.TELEGRAM_API_TOKEN}/getFile?file_id=${fileReference}`;
        const fileInfoRes = await fetch(getFileUrl);
        const fileInfoData = await fileInfoRes.json() as { ok: boolean; result: { file_path: string } };
        if (!fileInfoData.ok) {
          return { response: new Response("Failed to get file info", { status: 500 }), messageId: 0 };
        }
        const filePath = fileInfoData.result.file_path;
        const fileDownloadUrl = `${config.TELEGRAM_API_URL}/file/bot${config.TELEGRAM_API_TOKEN}/${filePath}`;
        const fileRes = await fetch(fileDownloadUrl);
        const fileBlob = await fileRes.blob();
        const r1Key = `files/${fileReference}`;
        await storage.putFile(r1Key, fileBlob);
        await db.insertFileRecord({
          telegramFileId: null,
          r1Key,
          createdAt: now,
        });
        fileReference = r1Key;
      }
    } else if (msg.document) {
      fileReference = msg.document.file_id;
      text = msg.caption || "";
      mediaType = "document";
    } else {
      text = JSON.stringify(msg);
      mediaType = "text";
    }

    const messageRecord: MessageRecord = {
      chatId,
      chatType,
      userId,
      content: text,
      mediaType,
      fileReference,
      processed: false,
      attempts: 0,
      processingDate: now,
      createdAt: now,
      prepared: false // Set the flag as false initially.
    };

    const result = await db.insertMessage(messageRecord);
    const insertedId = result.lastRowId;

    return { response: new Response("Message received", { status: 200 }), messageId: insertedId };
  } catch (err) {
    return { response: new Response("Error processing message", { status: 500 }), messageId: 0 };
  }
}
