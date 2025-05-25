// src/rateLimiter.ts
// This file provides a function to apply rate limiting rules based on chat type.
// The function groups messages by chat and enforces a limit on how many messages can be sent per second,
// depending on whether the chat is a private chat or a channel.

import { MessageRecord } from "./types/default";
import { getConfig } from "./config";
import { Env } from "./types/default";

/**
 * Applies rate limiting to a batch of messages by grouping them according to their chat ID
 * and selecting a subset that complies with the allowed rate for each chat.
 *
 * Private chats are limited to a lower rate (e.g., 1 message per second), while channels
 * are allowed a higher rate (e.g., 20 messages per second).
 *
 * @param messages - An array of message records to be processed.
 * @param env - The environment bindings containing configuration settings.
 * @returns An object containing two arrays: "selected" messages that meet the rate limit,
 *          and "deferred" messages that exceed the limit and should be postponed.
 */
export function applyRateLimit(messages: MessageRecord[], env: Env): { selected: MessageRecord[], deferred: MessageRecord[] } {
  const config = getConfig(env);
  const selected: MessageRecord[] = [];
  const deferred: MessageRecord[] = [];
  
  // Group messages by chatId
  const groups: { [chatId: string]: MessageRecord[] } = {};
  for (const msg of messages) {
    if (!groups[msg.chatId]) {
      groups[msg.chatId] = [];
    }
    groups[msg.chatId].push(msg);
  }

  for (const chatId in groups) {
    const group = groups[chatId];
    // Determine the allowed rate limit based on the type of chat.
    // For channels, the limit is higher (e.g., 20 messages per second); for private chats, it is lower (e.g., 1 message per second).
    const chatType = group[0].chatType;
    const limit = chatType === "channel" ? config.RATE_LIMIT_CHANNEL : config.RATE_LIMIT_PRIVATE;
    
    // Although the messages are likely already sorted by processingDate,
    // sort the group explicitly to ensure the correct order.
    group.sort((a, b) => a.processingDate - b.processingDate);
    
    // Select the first "limit" messages to be processed, and mark the remaining messages as deferred.
    const allowed = group.slice(0, limit);
    const extra = group.slice(limit);
    selected.push(...allowed);
    deferred.push(...extra);
  }
  
  return { selected, deferred };
}
