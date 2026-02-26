#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const MEMORY_FILE = '/Users/yitzi/.claude/projects/-Users-yitzi/memory/MEMORY.md';
const RECENT_CHANGES_MARKER = '## 🔄 Recent Changes (Auto-Updated)';
const MAX_ENTRIES = 15;

// Color codes for terminal
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

/**
 * Parse commit message to extract type and message
 * Looks for [TYPE] prefix: [FEATURE], [FIX], [BREAKING], etc.
 */
function parseCommitMessage(message) {
  const typeMatch = message.match(/^\[([A-Z]+)\]\s*(.+)/);
  if (typeMatch) {
    return {
      type: typeMatch[1],
      message: typeMatch[2].trim()
    };
  }
  return {
    type: 'CHANGE',
    message: message.split('\n')[0].trim()
  };
}

/**
 * Get emoji for commit type
 */
function getTypeEmoji(type) {
  const emojis = {
    'FEATURE': '✨',
    'FIX': '🐛',
    'BREAKING': '💥',
    'REFACTOR': '🔄',
    'DOCS': '📝',
    'TEST': '✅',
    'PERF': '⚡',
    'CHANGE': '📦'
  };
  return emojis[type] || '📌';
}

/**
 * Get latest commit info
 */
function getLatestCommit() {
  try {
    const gitDir = '/Users/yitzi/Documents/dealcellolaryk';
    
    // Get commit hash
    const hash = execSync('git -C ' + gitDir + ' rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    
    // Get full commit message
    const message = execSync('git -C ' + gitDir + ' log -1 --format=%B', { encoding: 'utf8' }).trim();
    
    // Get list of changed files
    let files = [];
    try {
      const filesRaw = execSync('git -C ' + gitDir + ' show --name-status --format=', { encoding: 'utf8' }).trim();
      files = filesRaw.split('\n').filter(line => line.length > 0).map(line => line.split('\t')[1] || line);
    } catch (e) {
      // Fallback if git show fails
    }
    
    return {
      hash,
      message,
      files: files.slice(0, 5) // Limit to first 5 files
    };
  } catch (error) {
    console.error('Error getting commit info:', error.message);
    return null;
  }
}

/**
 * Format commit entry for MEMORY.md
 */
function formatCommitEntry(commitInfo) {
  const { hash, message, files } = commitInfo;
  const parsed = parseCommitMessage(message);
  const emoji = getTypeEmoji(parsed.type);
  const now = new Date().toISOString().split('T')[0];
  const time = new Date().toISOString().split('T')[1].substring(0, 8);
  
  let entry = `#### ${emoji} [${parsed.type}] ${parsed.message}\n`;
  entry += `- **Time:** ${now} ${time}\n`;
  
  if (files && files.length > 0) {
    entry += `- **Files:** ${files.slice(0, 3).join(', ')}${files.length > 3 ? `, +${files.length - 3} more` : ''}\n`;
  }
  
  entry += `- **Commit:** ${hash}\n`;
  
  return entry;
}

/**
 * Check if commit already exists in memory
 */
function commitExists(hash) {
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      return false;
    }
    const content = fs.readFileSync(MEMORY_FILE, 'utf8');
    return content.includes(`- **Commit:** ${hash}`);
  } catch (e) {
    return false;
  }
}

/**
 * Update MEMORY.md with new commit
 */
function updateMemory(commitInfo) {
  try {
    const { hash } = commitInfo;
    
    // Check if already exists
    if (commitExists(hash)) {
      console.log(`${colors.yellow}⚠️  Commit ${hash} already in MEMORY.md${colors.reset}`);
      return false;
    }
    
    // Read existing memory
    let content = '';
    if (fs.existsSync(MEMORY_FILE)) {
      content = fs.readFileSync(MEMORY_FILE, 'utf8');
    }
    
    // Find Recent Changes section
    let markerIndex = content.indexOf(RECENT_CHANGES_MARKER);
    
    if (markerIndex === -1) {
      // Create new section
      const newSection = `${RECENT_CHANGES_MARKER}\n\n${formatCommitEntry(commitInfo)}\n`;
      content = newSection + content;
    } else {
      // Insert after marker
      const insertIndex = markerIndex + RECENT_CHANGES_MARKER.length + 1;
      const newEntry = formatCommitEntry(commitInfo);
      
      // Count existing entries
      const afterMarker = content.substring(insertIndex);
      const entryCount = (afterMarker.match(/^####/gm) || []).length;
      
      // Insert new entry
      content = content.substring(0, insertIndex) + '\n' + newEntry + content.substring(insertIndex);
      
      // Cleanup old entries if exceeding MAX_ENTRIES
      if (entryCount >= MAX_ENTRIES) {
        const lines = content.split('\n');
        let currentLine = 0;
        let entryIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('####')) {
            entryIndex++;
            if (entryIndex > MAX_ENTRIES) {
              // Find end of this entry (next #### or ## or EOF)
              let endLine = i + 4;
              while (endLine < lines.length && !lines[endLine].startsWith('#')) {
                endLine++;
              }
              // Remove old entry
              lines.splice(i, endLine - i);
              i--;
            }
          }
        }
        content = lines.join('\n');
      }
    }
    
    // Write back
    fs.writeFileSync(MEMORY_FILE, content, 'utf8');
    
    console.log(`${colors.green}✅ Updated MEMORY.md with commit ${hash}${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.yellow}⚠️  Error updating MEMORY.md:${colors.reset}`, error.message);
    return false;
  }
}

/**
 * Main: Get latest commit and update memory
 */
function main() {
  const commitInfo = getLatestCommit();
  
  if (!commitInfo) {
    console.error('Failed to get commit info');
    process.exit(1);
  }
  
  const updated = updateMemory(commitInfo);
  
  if (!updated) {
    // Silent exit if commit already exists or error
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { updateMemory, getLatestCommit, formatCommitEntry };
