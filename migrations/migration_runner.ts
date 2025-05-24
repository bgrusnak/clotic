#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Migration {
  version: string;
  filename: string;
  content: string;
}

function loadMigrations(): Migration[] {
  const migrationsDir = __dirname;
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && f.match(/^\d{3}_/))
    .sort();

  return files.map(filename => {
    const version = filename.substring(0, 3);
    const content = readFileSync(join(migrationsDir, filename), 'utf8');
    return { version, filename, content };
  });
}

async function executeD1Command(sql: string, isRemote: boolean = false): Promise<string> {
  const remoteFlag = isRemote ? '--remote' : '';
  const escapedSql = sql.replace(/"/g, '\\"');
  const command = `wrangler d1 execute velari ${remoteFlag} --command="${escapedSql}"`;

  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr && !stderr.includes('🌀')) {
      console.warn('D1 warning:', stderr);
    }
    return stdout;
  } catch (error: any) {
    throw new Error(`D1 command failed: ${error.message}`);
  }
}

function extractJsonArray(text) {
  const startIdx = text.indexOf('[');
  if (startIdx === -1) return null;
  // Ищем конец массива — подбираем скобки
  let bracketCount = 0, endIdx = -1;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '[') bracketCount++;
    if (text[i] === ']') bracketCount--;
    if (bracketCount === 0) {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return null;
  const jsonString = text.slice(startIdx, endIdx + 1);
  return jsonString;
}

 

async function getAppliedMigrations(isRemote: boolean): Promise<string[]> {
  try {
    await executeD1Command(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `, isRemote);

    const result = await executeD1Command(
      'SELECT version FROM schema_migrations ORDER BY version',
      isRemote
    );
    const dbData = extractJsonArray(result);

    if (dbData === null) {
      return [];
    }
    return JSON.parse(dbData)[0].results.map(r => r.version);
  } catch (error) { 
    console.warn('Could not get applied migrations, assuming none applied');
    return [];
  }
}


function extractStatements(sql: string): string[] {
  return sql
    .split(';').map(query => {
      return query.split('\n')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--')).join('\n');
    });
}

async function applyMigration(migration: Migration, isRemote: boolean): Promise<void> {
  const statements = extractStatements(migration.content);
  for (const statement of statements) {
    if (statement.length > 0) {
      await executeD1Command(statement, isRemote);
    }
  }
}

async function runMigrations(isRemote: boolean = false): Promise<void> {
  console.log('Loading migrations...');
  const migrations = loadMigrations();

  console.log('Checking applied migrations...');
  const appliedVersions = await getAppliedMigrations(isRemote);

  const pendingMigrations = migrations.filter(
    m => !appliedVersions.includes(m.version)
  );
 
  if (pendingMigrations.length === 0) {
    console.log('✅ No pending migrations');
    return;
  }

  console.log(`📦 Found ${pendingMigrations.length} pending migrations`);

  for (const migration of pendingMigrations) {
    console.log(`⚡ Applying migration ${migration.version}...`);
    await applyMigration(migration, isRemote);
    console.log(`✅ Migration ${migration.version} applied`);
  }

  console.log('🎉 All migrations completed successfully');
}

async function rollbackMigration(isRemote: boolean = false): Promise<void> {
  const appliedVersions = await getAppliedMigrations(isRemote);

  if (appliedVersions.length === 0) {
    console.log('❗ No migrations to rollback');
    return;
  }

  const lastVersion = appliedVersions[appliedVersions.length - 1];
  console.log(`🔄 Rolling back migration ${lastVersion}...`);

  await executeD1Command(
    `DELETE FROM schema_migrations WHERE version = '${lastVersion}'`,
    isRemote
  );

  console.log(`✅ Migration ${lastVersion} rolled back`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isRemote = args.includes('--remote');
  const isRollback = args.includes('--rollback');

  console.log(`🚀 Running migrations ${isRemote ? '(remote)' : '(local)'}`);

  try {
    if (isRollback) {
      await rollbackMigration(isRemote);
    } else {
      await runMigrations(isRemote);
    }
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();