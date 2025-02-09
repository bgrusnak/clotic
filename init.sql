-- SQL script to initialize the Cloudflare D1 database schema.
-- This script creates two tables:
--   1. "messages": To store incoming Telegram messages with their metadata.
--   2. "file_identifiers": To keep track of files stored in R1 and their associated Telegram file IDs.

-- Use next lines for the database reset
-- DROP TABLE IF EXISTS messages;
-- DROP TABLE IF EXISTS file_identifiers;


 
-- Create the "messages" table.
-- This table stores details about each Telegram message that is received.
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,         -- Unique identifier for each message (auto-incremented).
    chatId TEXT NOT NULL,                           -- Identifier of the chat from which the message originated.
    chatType TEXT NOT NULL,                         -- Type of chat (e.g., 'private', 'group', 'supergroup', 'channel').
    userId TEXT NOT NULL,                           -- Identifier of the user who sent the message.
    content TEXT NOT NULL,                          -- The content of the message (text or JSON payload for non-text messages).
    mediaType TEXT NOT NULL,                        -- Type of media attached (e.g., 'text', 'photo', 'video', etc.).
    fileReference TEXT,                             -- Reference to the file (could be a Telegram file_id, R1 key, or URL).
    processed INTEGER NOT NULL DEFAULT 0,           -- Processing flag (0 = not processed, 1 = processed).
    attempts INTEGER NOT NULL DEFAULT 0,            -- Number of processing attempts made.
    processingDate INTEGER NOT NULL,                -- Timestamp (in milliseconds) indicating when the message should be processed.
    createdAt INTEGER NOT NULL,                     -- Timestamp (in milliseconds) when the message was initially received.
    prepared INTEGER NOT NULL DEFAULT 0             -- Preparing flag (0 = not prepared, 1 = prepared).
);

-- Create the "file_identifiers" table.
-- This table tracks files that are stored in R1 and may later receive a Telegram file_id after successful transmission.
CREATE TABLE IF NOT EXISTS file_identifiers (
    r1Key TEXT PRIMARY KEY,                         -- The key under which the file is stored in R1.
    telegramFileId TEXT,                            -- The Telegram file_id (can be null if not yet obtained).
    createdAt INTEGER NOT NULL                      -- Timestamp (in milliseconds) when the file record was created.
);
  