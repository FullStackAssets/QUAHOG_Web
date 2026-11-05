#!/usr/bin/env bash
# Quahog game — music guard. Fails if any music/audio file is tracked
# (or present in the working tree) outside the explicit allowlist.
# The game's music must NEVER enter any repo. Allowlist: .audio-allowlist,
# one exact path per line, empty or missing = nothing allowed.
set -uo pipefail

cd "$(dirname "$0")/.."

ALLOWLIST=".audio-allowlist"
declare -a ALLOW=()
if [ -f "$ALLOWLIST" ]; then
  while IFS= read -r line; do
    [ -n "$line" ] && ALLOW+=("$line")
  done < "$ALLOWLIST"
fi

is_allowed() {
  local f="$1"
  for a in "${ALLOW[@]:-}"; do
    [ "$f" = "$a" ] && return 0
  done
  return 1
}

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  FILES="$(git ls-files)"
else
  FILES="$(find . -type f -not -path './node_modules/*' -not -path './dist/*' -not -path './.git/*' | sed 's|^\./||')"
fi

OFFENDERS=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    *music/*|music/*)
      is_allowed "$f" || OFFENDERS+=("$f (music path)")
      ;;
    *.mp3|*.wav|*.flac|*.ogg|*.oga|*.m4a|*.aac|*.wma|*.aiff|*.aif)
      is_allowed "$f" || OFFENDERS+=("$f (audio file)")
      ;;
  esac
done <<< "$FILES"

if [ "${#OFFENDERS[@]}" -gt 0 ]; then
  echo "MUSIC GUARD FAILED — these files must not be in the repo:"
  printf '  %s\n' "${OFFENDERS[@]}"
  echo "Remove them (git rm --cached + delete) or, for a genuinely needed"
  echo "game audio file only, add the exact path to .audio-allowlist with a"
  echo "note in SETUP.md, then git add -f that one file."
  exit 1
fi
echo "music guard: clean (allowlist entries: ${#ALLOW[@]})"
