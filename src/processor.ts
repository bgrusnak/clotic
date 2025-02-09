// src/processor.ts
// This file defines the processMessages function which is responsible for processing queued messages.
// The function selects a batch of unprocessed messages from the database, applies rate limiting,
// sends the messages via the Telegram API, and updates the database based on the outcome.
// It continues processing messages in a loop until the processing window (59 seconds) expires.

import { Env, MessageRecord } from "./types";
import { Database } from "./db";
import { StorageHelper } from "./storage";
import { TelegramClient, TelegramSendResult } from "./telegram";
import { getConfig } from "./config";
import { applyRateLimit } from "./rateLimiter";

/**
 * Pauses execution for a specified number of milliseconds.
 * @param ms - The number of milliseconds to sleep.
 * @returns A Promise that resolves after the specified delay.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits until the beginning of the next second.
 * This is useful for aligning the processing loop with a per-second rate limit.
 */
async function sleepUntilNextSecond(): Promise<void> {
  const now = Date.now();
  const delay = 1000 - (now % 1000);
  await sleep(delay);
}

/**
 * Processes queued messages by performing the following steps:
 * 1. Retrieves up to RATE_LIMIT_GLOBAL unprocessed messages from the database whose processingDate is less than or equal to the current time.
 * 2. Applies rate limiting rules to ensure compliance with Telegram's message sending limits.
 * 3. Updates deferred messages by incrementing their processingDate by one second.
 * 4. If fewer than RATE_LIMIT_GLOBAL messages are selected, attempts to fetch additional messages until either RATE_LIMIT_GLOBAL messages are selected or no more messages are available.
 * 5. Sends the selected messages concurrently via the Telegram API.
 * 6. For each message, if sending is successful, marks the message as processed; if unsuccessful, increments the attempt count and updates the processingDate using exponential backoff (up to 256 minutes).
 * 7. Repeats the process until 59 seconds have elapsed from the start of processing.
 *
 * @param env - The environment bindings containing configuration settings and external resource references.
 */
export async function processMessages(env: Env): Promise<void> {
  const db = new Database(env.D1_DB);
  const config = getConfig(env);
  const storage = new StorageHelper(env.R2_BUCKET);
  const telegramClient = new TelegramClient(env, db, storage);

  const processingDuration = 59 * 1000; // Total processing window of 59 seconds.
  const startTime = Date.now();

  while (Date.now() - startTime < processingDuration) {
    const currentTime = Date.now();
    // Retrieve up to RATE_LIMIT_GLOBAL unprocessed messages scheduled for processing.
    let batch: MessageRecord[] = await db.getUnprocessedMessages(currentTime, config.RATE_LIMIT_GLOBAL);
    if (batch.length === 0) {
      await sleepUntilNextSecond();
      continue;
    }

    // Apply rate limiting rules to the batch of messages.
    const { selected, deferred } = applyRateLimit(batch, env);

    // For messages that exceed the rate limit (deferred), update their processingDate to delay processing by 1 second.
    for (const msg of deferred) {
      await db.updateMessageProcessingDate(msg.id!, msg.processingDate + 1000);
    }

    // If fewer than RATE_LIMIT_GLOBAL messages have been selected, attempt to fetch additional messages to fill the batch.
    const selectedIds = selected.map(msg => msg.id!);
    while (selected.length < config.RATE_LIMIT_GLOBAL) {
      const additional = await db.getUnprocessedMessagesExcluding(currentTime, selectedIds, config.RATE_LIMIT_GLOBAL - selected.length);
      if (additional.length === 0) break;
      const { selected: addSelected, deferred: addDeferred } = applyRateLimit(additional, env);
      selected.push(...addSelected);
      for (const msg of addDeferred) {
        await db.updateMessageProcessingDate(msg.id!, msg.processingDate + 1000);
      }
    }

    // Send all selected messages concurrently via the Telegram API.
    const sendResults: { msg: MessageRecord, result: TelegramSendResult }[] = await Promise.all(
      selected.map(async (msg) => {
        const result = await telegramClient.sendMessage(msg);
        return { msg, result };
      })
    );

    // Process the results of each send attempt.
    for (const { msg, result } of sendResults) {
      if (result.success) {
        // If the message was sent successfully, mark it as processed in the database.
        await db.markMessageProcessed(msg.id!);
      } else {
        // If sending failed, increment the attempt counter and calculate a new processing time using exponential backoff.
        const newAttempts = msg.attempts + 1;
        const delayMinutes = Math.min(Math.pow(2, newAttempts), 256);
        const newProcessingDate = Date.now() + delayMinutes * 60 * 1000;
        await db.updateMessageRetry(msg.id!, newAttempts, newProcessingDate);
      }
    }

    // Wait until the start of the next second before processing the next batch.
    await sleepUntilNextSecond();
  }
}
