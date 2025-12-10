# Loopy v1.2 PWA Guide

This document explains how to use Loopy as a Progressive Web App (PWA) with offline support and camera controls for zoom/pan.

**Version:** 1.2 (2025)
**Enhancements by:** Johnathon Rhoades & Claude Code
**Organization:** Rhoades Institute of Technology

---

## 🚀 What's New in the PWA Version?

### ✅ Progressive Web App Features
- **Install as an app** on desktop and mobile (Add to Home Screen)
- **100% offline** functionality after first load
- **App-like experience** in standalone mode (no browser UI)
- **Fast loading** with intelligent caching

### ✅ Camera Controls (NEW!)

**Desktop (mouse + keyboard):**
- **Alt + Mouse Wheel** → Zoom in/out (around cursor)
- **Alt + Middle Mouse Drag** → Pan the canvas

**Mobile/Tablet (touch):**
- **Pinch gesture** → Zoom in/out
- **Two-finger drag** → Pan the canvas

---

## 📱 Installing Loopy as a PWA

### Chrome / Edge (Desktop)
1. Open Loopy in Chrome or Edge
2. Look for the install icon (⊕) in the address bar
3. Click "Install" or go to **Menu → Install Loopy**
4. Loopy will open as a standalone app

### Chrome (Android)
1. Open Loopy in Chrome
2. Tap the menu (⋮) and select **"Add to Home screen"**
3. Tap "Add" to confirm
4. Launch from your home screen

### Safari (iOS/iPadOS)
1. Open Loopy in Safari
2. Tap the Share button (□↑)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap "Add"
5. Launch from your home screen

**Note:** iOS has quirks with PWAs:
- Service worker updates may require force-refresh
- Standalone mode has limited storage (consider clearing cache periodically)

---

## 🎮 Using Camera Controls

### Desktop

#### Zoom
- **Alt + Scroll Up** → Zoom in
- **Alt + Scroll Down** → Zoom out
- Zoom centers around your cursor position

#### Pan
- **Alt + Middle Mouse Button** → Hold and drag to pan
- Release Alt or the mouse button to stop panning

### Mobile

#### Pinch Zoom
- Use **two fingers** on the canvas
- Pinch together → Zoom out
- Spread apart → Zoom in
- Zoom centers around the pinch point

#### Pan
- Use **two fingers** to drag
- The canvas will follow your gesture

#### Configuration
- By default, panning requires **2 fingers**
- This can be changed in `Camera.js` by modifying `TOUCH_PAN_FINGERS` (line 16)

---

## 🛠️ Running Loopy Locally

To test the PWA, you need to serve it from a static web server (service workers require HTTPS or localhost).

### Option 1: Using Node.js
```bash
# Navigate to the v1.1 directory
cd v1.1

# Install a simple server (one-time)
npm install -g serve

# Serve the directory
serve .

# Open http://localhost:3000 in your browser
```

### Option 2: Using Python
```bash
# Navigate to the v1.1 directory
cd v1.1

# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Open http://localhost:8000 in your browser
```

### Option 3: GitHub Pages
1. Push the `v1.1` folder to your GitHub repository
2. Go to **Settings → Pages**
3. Set source to your main branch and `/v1.1` folder
4. GitHub will provide a URL (e.g., `https://username.github.io/loopy/v1.1/`)

---

## 🔄 How Offline Mode Works

### First Load
1. Open Loopy in your browser
2. The service worker installs and caches all core assets (~175KB)
3. You'll see "✓ Service Worker registered" in the browser console

### Subsequent Visits
- Loopy loads **instantly** from cache
- No network required
- Works even in airplane mode

### What's Cached?
- HTML, CSS, JavaScript files
- All UI icons, cursors, and sliders
- PWA icons
- **Help pages are NOT precached** (loaded on-demand to save space)

### Cache Updates
When Loopy is updated:
1. The service worker detects changes
2. It downloads the new version in the background
3. You'll see "✓ New version available! Refresh to update." in the console
4. Refresh the page to activate the new version

---

## 🔧 Development Notes

### Updating Cached Assets

When you modify Loopy files:

1. **Update the cache version** in `sw.js`:
   ```javascript
   const CACHE_VERSION = 'loopy-pwa-v2';  // Increment the version
   ```

2. **Add new files** to the precache list in `sw.js`:
   ```javascript
   const CORE_ASSETS = [
     './index.html',
     './css/loopy.css',
     // ... add your new files here
   ];
   ```

3. **Preserve query parameters** for versioned files:
   ```javascript
   './js/Loopy.js?v=5',  // Include the ?v=X param
   ```

### Testing Service Worker Updates

```javascript
// In browser console:

// 1. Check current service worker
navigator.serviceWorker.getRegistrations()

// 2. Force update
navigator.serviceWorker.getRegistration().then(reg => reg.update())

// 3. Clear all caches (for testing)
caches.keys().then(names => names.forEach(name => caches.delete(name)))
```

### Camera Configuration

Edit `/v1.1/js/Camera.js` to customize camera behavior:

```javascript
Camera.config = {
  MIN_SCALE: 0.25,           // Minimum zoom (25%)
  MAX_SCALE: 4.0,            // Maximum zoom (400%)
  ZOOM_FACTOR: 1.1,          // Zoom speed (1.1 = 10% per step)
  TOUCH_PAN_FINGERS: 2       // Fingers required for pan (2 or 3)
};
```

### Programmatic Camera Control

You can control the camera via JavaScript:

```javascript
// Set zoom level (1.0 = 100%, 2.0 = 200%, etc.)
Camera.setZoom(2.0);

// Set zoom with custom center point
Camera.setZoom(2.0, centerX, centerY);

// Reset camera to default
Camera.reset();
```

---

## 📋 Camera Implementation Details

### Architecture
- **Modular design**: All camera logic in `Camera.js` (~340 lines)
- **Uses existing transform system**: Loopy already had `offsetX`, `offsetY`, `offsetScale`
- **Coordinate transforms** handled automatically by existing code in `Mouse.js` and `Model.js`

### Key Functions

**Desktop Zoom (`onWheel`):**
- Detects `Alt` key + wheel event
- Calculates new scale with `ZOOM_FACTOR`
- Calls `zoomAroundPoint()` to keep cursor position stationary

**Desktop Pan (`onMouseDown/Move/Up`):**
- Detects `Alt` key + middle button (button 1)
- Tracks mouse delta
- Updates `offsetX` and `offsetY` directly

**Touch Zoom (`onTouchStart/Move/End`):**
- Detects two-finger touch
- Calculates distance between touches
- Compares to initial distance for scale factor
- Zooms around centroid of touch points

**Touch Pan (combined with zoom):**
- Tracks centroid position of touches
- Calculates centroid movement delta
- Updates offset to follow gesture

### Why This Design?

1. **Non-invasive**: Doesn't modify existing Loopy code (except 2 lines in `Loopy.js`)
2. **Standalone module**: All camera logic in one file
3. **Reuses infrastructure**: Leverages existing `offsetX/Y/Scale` system
4. **Well-commented**: Clear explanations for future modifications

---

## 🐛 Known Issues & Limitations

### iOS Safari Quirks
- **Touch gestures**: iOS may intercept some multi-touch gestures
  - Solution: `touch-action: none` applied in CSS
- **Service worker**: May not update immediately
  - Solution: Force-close Safari app and reopen

### Desktop Browser Conflicts
- **Alt + Wheel**: Some browsers use this for back/forward navigation
  - Solution: Custom keyboard shortcuts could be added as alternative
- **Middle mouse button**: May trigger browser-specific actions
  - Solution: The camera system prevents default behavior

### Performance
- **Large models**: Zooming with 100+ nodes may be slow on low-end devices
  - Future: Consider canvas layer optimization

---

## 🎯 Future Improvements

### Potential Enhancements
1. **Keyboard shortcuts**: Add `+`/`-` keys for zoom, arrow keys for pan
2. **Minimap**: Show overview of entire model
3. **Zoom to fit**: Auto-zoom to show all nodes
4. **Touch gestures**: Three-finger gestures for undo/redo
5. **Smoother zoom**: Add animation/easing for zoom transitions
6. **Dark mode**: Detect system preference and apply dark theme

### Advanced Features
- **Infinite canvas**: Remove zoom limits, add spatial hashing for large models
- **Layer system**: Separate zoom for UI vs. model
- **Gestures**: Custom gestures for tool switching

---

## 📞 Support

**Issues or questions?**
- GitHub: [Your repo URL here]
- Original Loopy: https://ncase.me/loopy/

**Reporting bugs:**
1. Open browser console (F12)
2. Look for errors
3. Report with browser/OS details

---

## 📄 License

Loopy is public domain (CC0) by Nicky Case.
PWA enhancements are also public domain.

**Credits:**
- Original Loopy: Nicky Case (@ncasenmare)
- PWA & Camera System: [Your name/attribution here]

---

## 🔑 Quick Reference

### Desktop Controls
| Action | Keys |
|--------|------|
| Zoom In | Alt + Scroll Up |
| Zoom Out | Alt + Scroll Down |
| Pan | Alt + Middle Mouse Drag |

### Mobile Controls
| Action | Gesture |
|--------|---------|
| Zoom | Pinch (2 fingers) |
| Pan | Two-finger drag |

### Cache Management
```javascript
// Clear cache (browser console)
caches.keys().then(names => names.forEach(name => caches.delete(name)))

// Force service worker update
navigator.serviceWorker.getRegistration().then(reg => reg.update())
```

### Configuration Files
- **PWA Manifest**: `manifest.webmanifest`
- **Service Worker**: `sw.js`
- **Camera Settings**: `js/Camera.js` (lines 12-16)
- **Touch Settings**: `css/loopy.css` (`touch-action` rules)

---

**Happy modeling! 🎨🔁**
