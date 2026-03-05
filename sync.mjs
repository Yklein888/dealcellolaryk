import { execSync } from 'child_process';
import { watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────
const DEBOUNCE_MS    = 4000;   // המתן 4s אחרי שינוי לפני commit
const PULL_EVERY_MS  = 60000;  // pull מ-GitHub כל 60s
const WATCH_DIRS     = ['src', 'api', 'public', 'supabase/migrations'];
const WATCH_FILES    = ['vercel.json', 'package.json', 'MEMORY.md', 'CLAUDE.md',
                        'index.html', 'tailwind.config.ts', 'vite.config.ts'];
const IGNORE         = [/node_modules/, /\.git/, /dist/, /\.local$/, /\.log$/];

// ── Git helper ───────────────────────────────────────────────
function git(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: __dirname, encoding: 'utf8', timeout: 30000
    }).trim();
  } catch (e) {
    return (e.stdout || e.message || '').trim();
  }
}

function ts() {
  return new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

function shouldIgnore(filename) {
  return IGNORE.some(r => r.test(filename));
}

// ── Push logic ───────────────────────────────────────────────
let timer     = null;
let isSyncing = false;

function scheduleCommit() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(doCommitAndPush, DEBOUNCE_MS);
}

function doCommitAndPush() {
  if (isSyncing) { scheduleCommit(); return; }
  isSyncing = true;

  const status = git('status --porcelain');
  if (!status) { isSyncing = false; return; }

  console.log(`\n📤 Syncing changes... [${ts()}]`);
  git('add -A');
  const out = git(`-c user.name="Yitzi" -c user.email="yklein89@gmail.com" commit -m "[sync] ${ts()}"`);
  if (out) console.log('  ' + out.split('\n')[0]);

  const push = git('push origin main');
  if (push && !push.includes('Everything up-to-date')) {
    console.log('  ' + push.split('\n').slice(-1)[0]);
  }
  console.log('  ✅ GitHub updated');
  isSyncing = false;
}

// ── Pull logic ───────────────────────────────────────────────
function doPull() {
  if (isSyncing) return;
  const out = git('pull origin main --no-rebase');
  if (out && !out.includes('Already up to date') && out.trim()) {
    console.log(`\n📥 Received new changes [${ts()}]:\n  ${out.split('\n').slice(0,4).join('\n  ')}`);
  }
}

// ── Start ────────────────────────────────────────────────────
console.log('\n🔄  Deal Cellular Auto-Sync');
console.log('────────────────────────────────────');
console.log(`📥  Pulling latest from GitHub...`);
doPull();
console.log('👀  Watching for file changes...');
console.log('   Auto-push : 4s after last change');
console.log('   Auto-pull : every 60s');
console.log('   Ctrl+C    : stop sync\n');

// Watch directories
for (const dir of WATCH_DIRS) {
  try {
    watch(join(__dirname, dir), { recursive: true }, (_, filename) => {
      if (filename && !shouldIgnore(filename)) {
        process.stdout.write(`  📝 ${filename}\n`);
        scheduleCommit();
      }
    });
  } catch (_) { /* dir might not exist */ }
}

// Watch root files
for (const file of WATCH_FILES) {
  try {
    watch(join(__dirname, file), () => scheduleCommit());
  } catch (_) {}
}

// Pull every 60s
setInterval(doPull, PULL_EVERY_MS);
