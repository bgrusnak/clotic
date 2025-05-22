-- Initial schema migration
-- Version: 000
-- Description: Base tables for message processing and file storage

-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
);

-- Create the "messages" table
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatId TEXT NOT NULL,
    chatType TEXT NOT NULL,
    userId TEXT NOT NULL,
    content TEXT NOT NULL,
    mediaType TEXT NOT NULL,
    fileReference TEXT,
    processed INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    processingDate INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    prepared INTEGER NOT NULL DEFAULT 0,
    content_queue_id INTEGER,
    admin_action TEXT
);

-- Create the "file_identifiers" table
CREATE TABLE IF NOT EXISTS file_identifiers (
    r2Key TEXT PRIMARY KEY,
    telegramFileId TEXT,
    createdAt INTEGER NOT NULL
);

-- Record this migration
INSERT OR IGNORE INTO schema_migrations (version, applied_at) 
VALUES ('000', strftime('%s', 'now') * 1000);