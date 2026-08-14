#!/bin/bash
# Screenshot all ELASTICO views — login first, then navigate via sidebar
set -e

PROJECT="/home/z/my-project"
DOWNLOAD="$PROJECT/download"
SERVER_URL="http://localhost:3000"

mkdir -p "$DOWNLOAD"

# 1. Start Next.js server in background
echo "[1/3] Starting Next.js server..."
cd "$PROJECT"
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
npx next start -p 3000 -H 0.0.0.0 > /tmp/nx.log 2>&1 &

# Wait for server
echo "Waiting for server..."
for i in $(seq 1 40); do
  if curl -s -o /dev/null -w '%{http_code}' "$SERVER_URL/" 2>/dev/null | grep -q 200; then
    echo "Server ready!"
    break
  fi
  sleep 1
done

# 2. Setup browser
echo "[2/3] Setting up browser..."
agent-browser set viewport 1366 768
agent-browser set media dark

# Navigate to app
agent-browser open "$SERVER_URL/" --timeout 15000
agent-browser wait 3000

# ─── SCREENSHOT: Login Page ───
echo ""
echo "Screenshot: Login Page"
agent-browser wait --load networkidle
agent-browser screenshot "$DOWNLOAD/elastico-login.png" --full
echo "  Saved: elastico-login.png"

# ─── LOGIN: Click Pro demo account ───
echo ""
echo "Logging in via Pro demo account..."

# Find and click the Pro demo button (it contains "Pro" text)
agent-browser find text "Pro" click --timeout 5000 || {
  echo "  Trying alternative login..."
  # Try clicking by finding the button with 'Pro' in it
  agent-browser snapshot -i
  # Look for any demo button
  agent-browser eval "
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.includes('Pro')) {
        btn.click();
        break;
      }
    }
  "
}

# Wait for login to complete and dashboard to render
echo "  Waiting for dashboard to load..."
agent-browser wait 5000
agent-browser wait --load networkidle
agent-browser wait 3000

# Verify we're on dashboard
TITLE=$(agent-browser get title 2>/dev/null || echo "")
echo "  Page title: $TITLE"

# ─── SCREENSHOT: Dashboard ───
echo ""
echo "Screenshot: Dashboard"
agent-browser wait --load networkidle
agent-browser wait 2000
agent-browser screenshot "$DOWNLOAD/elastico-dashboard.png" --full
echo "  Saved: elastico-dashboard.png"

# ─── Function: Navigate to view via sidebar and screenshot ───
screenshot_view() {
  local label="$1"
  local filename="$2"
  local sidebar_text="$3"
  
  echo ""
  echo "Screenshot: $label"
  
  # Click sidebar item
  agent-browser find text "$sidebar_text" click --timeout 5000 || {
    echo "  WARNING: Could not find sidebar text '$sidebar_text', trying eval..."
    agent-browser eval "
      const items = document.querySelectorAll('[data-sidebar-item], nav a, nav button');
      for (const item of items) {
        if (item.textContent.toLowerCase().includes('$sidebar_text'.toLowerCase())) {
          item.click();
          break;
        }
      }
    "
  }
  
  # Wait for view to render (lazy loaded)
  agent-browser wait 2000
  agent-browser wait --load networkidle
  agent-browser wait 2000
  
  # Take screenshot
  agent-browser screenshot "$DOWNLOAD/$filename" --full
  echo "  Saved: $filename"
}

# ─── SCREENSHOT ALL VIEWS ───
echo ""
echo "[3/3] Capturing all views..."

screenshot_view "Live Matches" "elastico-live-matches.png" "Live Matches"
screenshot_view "Match Analysis" "elastico-match-detail.png" "Match Analysis"
screenshot_view "Tactical Analysis" "elastico-tactical.png" "Tactical"
screenshot_view "Players" "elastico-players.png" "Players"
screenshot_view "Compare Teams" "elastico-compare.png" "Compare"
screenshot_view "Predictions" "elastico-predictions.png" "Predictions"
screenshot_view "Prediction Engine" "elastico-prediction-engine.png" "Pred. Engine"
screenshot_view "Standings" "elastico-standings.png" "Standings"
screenshot_view "Leaderboard" "elastico-leaderboard.png" "Leaderboard"
screenshot_view "AI Chat" "elastico-ai-chat.png" "AI Chat"
screenshot_view "News" "elastico-news.png" "News"
screenshot_view "Export" "elastico-export.png" "Export"
screenshot_view "Settings" "elastico-settings.png" "Settings"
screenshot_view "Admin" "elastico-admin.png" "Admin"
screenshot_view "System Monitor" "elastico-system-monitor.png" "System Monitor"

# Close browser
agent-browser close 2>/dev/null || true

echo ""
echo "====================================="
echo "All screenshots complete!"
echo "====================================="
echo ""
ls -lh "$DOWNLOAD"/elastico-*.png 2>/dev/null | awk '{print "  " $5 "  " $9}'