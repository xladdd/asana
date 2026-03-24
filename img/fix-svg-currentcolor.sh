#!/bin/bash

set -e

FOLDER="${1:-.}"

find "$FOLDER" -type f -name "*.svg" | while read -r file; do
  cp "$file" "$file.bak"

  perl -0pi -e '
    # Convert explicit black fills/strokes to currentColor
    s/fill="#000000"/fill="currentColor"/gi;
    s/fill="#000"/fill="currentColor"/gi;
    s/stroke="#000000"/stroke="currentColor"/gi;
    s/stroke="#000"/stroke="currentColor"/gi;

    # Convert black colors inside <style> blocks
    s/fill:\s*#000000/fill:currentColor/gi;
    s/fill:\s*#000(?=[;\}"])/fill:currentColor/gi;
    s/stroke:\s*#000000/stroke:currentColor/gi;
    s/stroke:\s*#000(?=[;\}"])/stroke:currentColor/gi;

    # Add fill="currentColor" to bare <path> tags
    # only if they do NOT already have fill= and do NOT have class=
    s/<path(?![^>]*\bfill=)(?![^>]*\bclass=)([^>]*)>/<path fill="currentColor"$1>/gi;
  ' "$file"

  echo "Fixed: $file"
done

echo "Done. Backups saved as .bak files."
