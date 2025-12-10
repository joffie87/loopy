# 🚀 Loopy v1.2 PWA Quick Start

## Test Locally (5 minutes)

### Step 1: Serve the App
```bash
# In the v1.2 directory
cd v1.2

# Option A: Node.js (recommended)
npx serve .

# Option B: Python 3
python3 -m http.server 8000
```

### Step 2: Open in Browser
- **Node**: http://localhost:3000
- **Python**: http://localhost:8000

### Step 3: Install as PWA
1. Look for install icon (⊕) in address bar
2. Click "Install Loopy"
3. App opens in standalone window

### Step 4: Test Camera Controls

**Desktop:**
- Hold `Alt` and scroll wheel → Zoom
- Hold `Alt` and drag with middle mouse → Pan

**Mobile:**
- Pinch with 2 fingers → Zoom
- Drag with 2 fingers → Pan

### Step 5: Test Offline
1. Open browser DevTools (F12)
2. Go to Network tab
3. Check "Offline" mode
4. Refresh Loopy → Should still work!

---

## Check Installation

Open browser console (F12) and look for:
```
[Camera] Initialized with config: {MIN_SCALE: 0.25, MAX_SCALE: 4, ...}
✓ Service Worker registered: http://localhost:3000/
```

If you see these messages, everything is working!

---

## Deploy to GitHub Pages

```bash
# 1. Commit changes
git add .
git commit -m "Add PWA support and camera controls"

# 2. Push to GitHub
git push origin main

# 3. Enable GitHub Pages
# Go to Settings → Pages
# Set source to main branch, /v1.2 folder

# 4. Access at:
# https://[username].github.io/[repo]/v1.2/
```

---

## Troubleshooting

**Service worker not registering?**
- Must use HTTPS or localhost
- Check browser console for errors

**Camera not working?**
- Open console, look for `[Camera] Initialized`
- Try different browser (Chrome/Edge recommended)

**PWA won't install?**
- Check manifest.webmanifest is loading
- Need HTTPS or localhost
- iOS: Use Safari, not Chrome

---

For full documentation, see `README_PWA.md`
