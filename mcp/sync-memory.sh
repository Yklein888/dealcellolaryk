#!/bin/bash

# Sync Memory Script - Update MEMORY.md with latest git commits
# Works locally AND on GitHub Actions

REPO_ROOT="/Users/yitzi/Documents/dealcellolaryk"
MEMORY_FILE="/Users/yitzi/.claude/projects/-Users-yitzi/memory/MEMORY.md"
RECENT_CHANGES_MARKER="## 🔄 Recent Changes (Auto-Updated)"

# Parse commit type
parse_type() {
  if [[ "$1" =~ ^\[([A-Z]+)\] ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "CHANGE"
  fi
}

# Get emoji
get_emoji() {
  case "$1" in
    FEATURE) echo "✨" ;;
    FIX) echo "🐛" ;;
    BREAKING) echo "💥" ;;
    REFACTOR) echo "🔄" ;;
    DOCS) echo "📝" ;;
    TEST) echo "✅" ;;
    PERF) echo "⚡" ;;
    CLEANUP) echo "🧹" ;;
    AUTO) echo "🤖" ;;
    *) echo "📦" ;;
  esac
}

# Extract message
extract_msg() {
  if [[ "$1" =~ ^\[[A-Z]+\]\ (.+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "$1"
  fi
}

# Check if commit exists - use simpler grep
commit_exists() {
  local short_hash="${1:0:7}"
  [ -f "$MEMORY_FILE" ] && grep "Commit: $short_hash" "$MEMORY_FILE" > /dev/null 2>&1
}

# Get commits
get_commits() {
  cd "$REPO_ROOT" || exit 1
  git log --oneline -n 30 2>/dev/null | head -20
}

# Main sync
main() {
  echo "[SYNC] Starting memory sync..."

  if [ ! -f "$MEMORY_FILE" ]; then
    echo "[ERROR] MEMORY.md not found"
    exit 1
  fi

  local commits=$(get_commits)
  [ -z "$commits" ] && { echo "[SKIP] No commits"; exit 0; }

  local new_entries=""
  local count=0

  while IFS=' ' read -r hash msg; do
    [ -z "$hash" ] && continue
    
    # Check if already exists
    if commit_exists "$hash"; then
      echo "[SKIP] $hash already in MEMORY"
      continue
    fi

    cd "$REPO_ROOT" || exit 1
    local full_msg=$(git log -1 --format=%B "$hash" 2>/dev/null | head -1)
    local timestamp=$(git log -1 --format=%ai "$hash" 2>/dev/null)
    local date=$(echo "$timestamp" | cut -d' ' -f1)
    local time=$(echo "$timestamp" | cut -d' ' -f2 | cut -d':' -f1,2)
    
    # Get files safely
    local files=""
    files=$(git show --format= --name-status "$hash" 2>/dev/null | cut -f2 | head -3 | paste -sd ',' - 2>/dev/null) || files=""

    local type=$(parse_type "$full_msg")
    local emoji=$(get_emoji "$type")
    local clean_msg=$(extract_msg "$full_msg")
    local short_hash="${hash:0:7}"

    new_entries+="#### ${emoji} [${type}] ${clean_msg}"$'\n'
    new_entries+="- **Time:** ${date} ${time}"$'\n'
    if [ -n "$files" ] && [ "$files" != "-" ]; then
      new_entries+="- **Files:** ${files}"$'\n'
    fi
    new_entries+="- **Commit:** ${short_hash}"$'\n'
    new_entries+=$'\n'

    ((count++))
    echo "[ADD] $short_hash - $clean_msg"
  done <<< "$commits"

  if [ $count -eq 0 ]; then
    echo "[SKIP] No new commits to add"
    exit 0
  fi

  echo "[UPDATE] Adding $count commits to MEMORY.md..."

  # Update file carefully
  local marker_line=$(grep -n "$RECENT_CHANGES_MARKER" "$MEMORY_FILE" | cut -d: -f1)
  if [ -z "$marker_line" ]; then
    echo "[ERROR] Marker not found in MEMORY.md"
    exit 1
  fi

  # Create temp file with new entries
  local temp=$(mktemp)
  
  # Copy everything up to and including marker
  head -n "$marker_line" "$MEMORY_FILE" > "$temp"
  
  # Add blank line and new entries
  echo "" >> "$temp"
  echo "$new_entries" >> "$temp"
  
  # Add rest of file
  tail -n "+$((marker_line + 2))" "$MEMORY_FILE" >> "$temp" 2>/dev/null || true

  # Replace original
  mv "$temp" "$MEMORY_FILE"
  
  echo "[SUCCESS] Added $count commits to MEMORY.md"
  exit 0
}

main "$@"
