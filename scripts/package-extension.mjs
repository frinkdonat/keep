import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'extension');
const distDir = path.join(rootDir, 'dist');
const zipFile = path.join(distDir, 'keep-extension-webstore.zip');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log('Packaging Chrome Extension into dist/keep-extension-webstore.zip...');

try {
  // Use zip CLI when available to ensure valid POSIX zip format
  execSync(`zip -r -FS "${zipFile}" . -x "*.DS_Store" "*Thumbs.db*"`, {
    cwd: extensionDir,
    stdio: 'inherit',
  });
  console.log('✓ Successfully packaged extension with POSIX paths.');
} catch {
  console.error('Failed to run zip command. Make sure zip is installed.');
  process.exit(1);
}
