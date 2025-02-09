// src/followUp.ts
import { Env } from "./types";
import { Database } from "./db";

/**
 * A follow-up task that waits 15 seconds and then updates the content of the message
 * with the given ID by prepending "I have got your message: " to the original text,
 * and marks the message as prepared.
 *
 * @param messageId - The ID of the message to update.
 * @param env - The environment bindings.
 */
export async function followUpTask(messageId: number, env: Env): Promise<void> {
  // Wait for 15 seconds.
  await new Promise((resolve) => setTimeout(resolve, 15000));
  const db = new Database(env.D1_DB);
  const prefix = "I have got your message: ";
  await db.prependMessageContentAndMarkPrepared(messageId, prefix);
}
