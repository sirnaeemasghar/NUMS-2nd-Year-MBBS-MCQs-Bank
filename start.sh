#!/usr/bin/env bash

# Launcher script for NUMS 2nd Year MCQs Local Portal
# Simply run ./start.sh to open the app directly in your default browser.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo "  NUMS 2nd Year MCQs (Proff 2025, Preproff 2025, 2026)"
echo "  Blocks 4, 5 & 6 (2,010 Clinical MCQs • Complete Syllabus)"
echo "=========================================================="
echo ""

if [ "$1" == "--server" ] || [ "$1" == "-s" ]; then
    echo "Starting local Python web server at http://localhost:8080..."
    echo "Press Ctrl+C to stop the server."
    open "http://localhost:8080"
    python3 -m http.server 8080
else
    echo "Opening local portal in your default browser..."
    open "$DIR/index.html"
    echo "Done! If you ever want to run via a local HTTP server instead, use:"
    echo "  ./start.sh --server"
fi
