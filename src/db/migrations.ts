// src/db/migrations.ts
export interface MigrationRecord {
    version: string;
    applied_at: number;
  }
  
  export class MigrationsDatabase {
    private db: D1Database;
  
    constructor(db: D1Database) {
      this.db = db;
    }
  
    /**
     * Gets all applied migration versions
     */
    async getAppliedMigrations(): Promise<string[]> {
      try {
        const query = 'SELECT version FROM schema_migrations ORDER BY version';
        const result = await this.db.prepare(query).all<MigrationRecord>();
        return result.results?.map(r => r.version) || [];
      } catch (error) {
        return [];
      }
    }
  
    /**
     * Records a migration as applied
     */
    async recordMigration(version: string): Promise<void> {
      const query = 'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)';
      await this.db.prepare(query).bind(version, Date.now()).run();
    }
  
    /**
     * Removes migration record
     */
    async removeMigration(version: string): Promise<void> {
      const query = 'DELETE FROM schema_migrations WHERE version = ?';
      await this.db.prepare(query).bind(version).run();
    }
  
    /**
     * Gets latest migration version
     */
    async getLatestVersion(): Promise<string | null> {
      try {
        const query = 'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1';
        const result = await this.db.prepare(query).first<MigrationRecord>();
        return result?.version || null;
      } catch (error) {
        return null;
      }
    }
  
    /**
     * Checks if migration table exists
     */
    async migrationTableExists(): Promise<boolean> {
      try {
        const query = "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'";
        const result = await this.db.prepare(query).first();
        return !!result;
      } catch (error) {
        return false;
      }
    }
  
    /**
     * Creates migration table if it doesn't exist
     */
    async createMigrationTable(): Promise<void> {
      const query = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at INTEGER NOT NULL
        )
      `;
      await this.db.prepare(query).run();
    }
  }