import { writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getNextVersion(): string {
  const migrationsDir = __dirname;
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && f.match(/^\d{3}_/))
    .sort();

  if (files.length === 0) {
    return '000';
  }

  const lastFile = files[files.length - 1];
  const lastVersion = parseInt(lastFile.substring(0, 3));
  const nextVersion = lastVersion + 1;

  return nextVersion.toString().padStart(3, '0');
}

function createMigrationTemplate(name: string, version: string): string {
  return `-- ${name} migration
-- Version: ${version}
-- Description: ${name}

-- Add your migration SQL here



-- Record this migration
INSERT OR IGNORE INTO schema_migrations (version, applied_at) 
VALUES ('${version}', strftime('%s', 'now') * 1000);`;
}

function createMigration(name: string): void {
  if (!name) {
    console.error('❌ Migration name is required');
    console.log('Usage: npm run migration:new <name>');
    process.exit(1);
  }

  const version = getNextVersion();
  const filename = `${version}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
  const filepath = join(__dirname, filename);
  
  const template = createMigrationTemplate(name, version);
  
  writeFileSync(filepath, template);
  
  console.log(`✅ Created migration: ${filename}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const name = args.join(' ');
  
  createMigration(name);
}

main();