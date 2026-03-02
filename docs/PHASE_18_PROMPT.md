# Phase 18: PWA + Mobile Camera + UI Polish

> **Status**: 📋 Ready to execute
> **Prerequisite**: Phase 16 + 17 complete
> **Goal**: Make the app usable at Walgreens on a phone

## Context Documents (Read First)
1. `docs/Product_Constitution.md` — What we're building and why
2. `docs/GOVERNANCE_BLUEPRINT.md` — How to build safely
3. `docs/SESSION_HANDOFF.md` — Current state and patterns

---

## Why This Phase

The app works on desktop with file upload, but the **Walgreens scenario** requires:

1. **Phone in hand** — Pull out phone, open app quickly
2. **Point camera at product** — Not "upload a file", but instant camera
3. **Works offline-ish** — At least loads when signal is weak
4. **Feels like an app** — Full screen, no browser chrome

Without PWA setup, users have to:
- Open browser → navigate to URL → wait for load → tap upload → select camera → take photo

With PWA:
- Tap home screen icon → app opens → tap camera → snap → done

---

## Requirements

### 18.1 PWA Manifest

**Create:** `public/manifest.json`

```json
{
  "name": "Allergy Angel",
  "short_name": "AllergyAngel",
  "description": "Family allergy and medication safety checks",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#dc2626",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 18.2 App Icons

**Create icons in:** `public/icons/`

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192x192 | Android home screen |
| `icon-512.png` | 512x512 | Android splash, PWA install |
| `apple-touch-icon.png` | 180x180 | iOS home screen |
| `favicon.ico` | 32x32 | Browser tab |

**Design suggestion:** Simple angel wing or shield icon in the app's red/coral color (`#dc2626`).

For quick iteration, use a placeholder or generate with an online tool. Can polish later.

### 18.3 HTML Head Tags

**Modify:** `index.html`

```html
<head>
  <!-- Existing tags... -->
  
  <!-- PWA -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#dc2626">
  
  <!-- iOS -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Allergy Angel">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
  
  <!-- Viewport (should exist, verify) -->
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
</head>
```

### 18.4 Service Worker (Minimal)

For v1, a minimal service worker that caches the app shell. Not full offline support yet.

**Create:** `public/sw.js`

```javascript
const CACHE_NAME = 'allergy-angel-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and API requests
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});
```

**Register in:** `src/main.tsx` or `src/App.tsx`

```typescript
// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration failed:', err);
    });
  });
}
```

### 18.5 Mobile Camera (Direct Capture)

**Current state:** PhotoCapture uses file input, which works but requires extra taps on mobile.

**Improve:** Add direct camera capture option using `capture` attribute.

**Modify:** `src/components/ui/PhotoCapture.tsx`

```tsx
// Ideal: Two buttons
<div className="flex gap-2">
  {/* Direct camera - opens camera immediately */}
  <label className="btn btn-primary flex-1">
    <CameraIcon className="w-5 h-5 mr-2" />
    Take Photo
    <input 
      type="file" 
      accept="image/*" 
      capture="environment"
      className="hidden"
      onChange={handleFileChange}
    />
  </label>
  
  {/* File picker - for existing photos */}
  <label className="btn btn-secondary flex-1">
    <UploadIcon className="w-5 h-5 mr-2" />
    Upload
    <input 
      type="file" 
      accept="image/png,image/jpeg,image/gif,image/webp"
      className="hidden"
      onChange={handleFileChange}
    />
  </label>
</div>
```

**Key:** The `capture="environment"` attribute tells mobile browsers to open the rear camera directly instead of showing a file picker.

### 18.6 UI Polish

**Priority fixes for real-world use:**

#### A. Ask Page
- Camera button should be prominent (primary action)
- "Checking for: [name]" should be clearly visible
- Loading state during extraction should feel fast (optimistic UI)
- Error states should be helpful ("Camera access denied - check settings")

#### B. Result Page
- Risk badge should be immediately visible (above fold)
- HIGH RISK should feel urgent (red, bold)
- SAFE should feel reassuring (green, clear)
- "Why?" should be easy to tap

#### C. Profile Switcher
- Should work well on small screens
- Currently selected profile should be obvious
- Switching should feel instant

#### D. General
- No horizontal scroll on mobile
- Touch targets at least 44x44px
- Text readable without zooming
- No layout shifts during load

### 18.7 Camera Permissions

**Handle permission denied gracefully:**

```tsx
const checkCameraPermission = async () => {
  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    if (result.state === 'denied') {
      return { granted: false, message: 'Camera access denied. Check your browser settings.' };
    }
    return { granted: true };
  } catch {
    return { granted: true };
  }
};
```

**Show helpful message if denied:**

```tsx
{cameraError && (
  <div className="text-red-600 text-sm mt-2">
    {cameraError}
    <br />
    <span className="text-gray-500">
      On iOS: Settings → Safari → Camera
      <br />
      On Android: Settings → Apps → Browser → Permissions
    </span>
  </div>
)}
```

---

## Files to Create/Change

| Action | File | Change |
|--------|------|-------|
| CREATE | `public/manifest.json` | PWA manifest |
| CREATE | `public/sw.js` | Service worker |
| CREATE | `public/icons/icon-192.png` | Android icon |
| CREATE | `public/icons/icon-512.png` | Android splash |
| CREATE | `public/icons/apple-touch-icon.png` | iOS icon |
| CREATE | `public/favicon.ico` | Browser tab |
| MODIFY | `index.html` | PWA meta tags |
| MODIFY | `src/main.tsx` or `src/App.tsx` | SW registration |
| MODIFY | `src/components/ui/PhotoCapture.tsx` | Direct camera capture |
| MODIFY | Various | UI polish |

---

## Testing

### PWA Install Test
1. Deploy to Vercel (HTTPS required)
2. Open on phone in Chrome/Safari
3. Should see "Add to Home Screen" prompt (or find in browser menu)
4. Tap to install
5. App appears on home screen with icon
6. Open from home screen → full screen, no browser chrome

### Camera Test (Mobile)
1. Open app on phone
2. Go to Ask page
3. Tap "Take Photo" button
4. Camera should open **immediately** (not file picker)
5. Take photo
6. See preview with extracted text

### Offline Test (Basic)
1. Install PWA
2. Open app (loads normally)
3. Turn on airplane mode
4. Close and reopen app
5. App shell should load (API calls will fail, that's fine for v1)

---

## Acceptance Test

**Part A: Deployment (on computer)**
1. ☐ Environment variables set in Vercel Dashboard
2. ☐ Migration `006_multi_profile.sql` run on production Supabase
3. ☐ `vercel --prod` or push to main succeeds
4. ☐ Production URL loads without errors
5. ☐ Can create/switch profiles on production

**Part B: PWA Install (on phone)**
6. ☐ Open production URL on phone
7. ☐ Can add app to home screen (iOS and/or Android)
8. ☐ App icon appears on home screen
9. ☐ Opening from home screen shows full-screen app (no browser bar)

**Part C: Camera (on phone)**
10. ☐ "Take Photo" button opens camera directly (no file picker)
11. ☐ Can take photo of a product label
12. ☐ Photo extracts text and shows preview
13. ☐ Can submit check and see verdict

**Part D: End-to-End (on phone)**
14. ☐ Profile switcher works on mobile
15. ☐ Peanut product → HIGH RISK for allergic profile
16. ☐ Fish oil → MEDIUM RISK for Eliquis profile
17. ☐ Result is readable without zooming
18. ☐ App loads when reopened

---

## 18.8 Deploy to Vercel Production

**Current state:** Running locally with `vercel dev`
**Required:** Deployed to `https://your-app.vercel.app` (HTTPS required for PWA + camera)

### Deployment Steps

1. **Verify environment variables in Vercel Dashboard:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - Any other env vars from `.env.local`

2. **Run production migration:**
   ```bash
   # Run 006_multi_profile.sql against production Supabase
   # Via Supabase Dashboard → SQL Editor, or psql
   ```

3. **Deploy:**
   ```bash
   # If using Vercel CLI
   vercel --prod
   
   # Or push to main branch if GitHub integration is set up
   git push origin main
   ```

4. **Verify deployment:**
   - Open `https://your-app.vercel.app` on desktop
   - Check that profiles work (Phase 16)
   - Check that photo upload works (Phase 17)
   - Check for console errors

5. **Test PWA on phone:**
   - Open production URL on phone
   - Should see "Add to Home Screen" prompt
   - Install and test

### Environment Variable Checklist

| Variable | Purpose | Set in Vercel? |
|----------|---------|----------------|
| `SUPABASE_URL` | Database connection | ☐ |
| `SUPABASE_SERVICE_ROLE_KEY` | Database auth | ☐ |
| `OPENAI_API_KEY` | LLM extraction | ☐ |
| `EXTRACTION_MODE` | `llm` or `heuristic` | ☐ |
| `ADMIN_ENABLED` | Enable admin endpoints | ☐ (optional for prod) |

---

## 18.9 Mobile Testing Checklist (Pre-Walgreens)

After deploying to prod, test these on your actual phone at home:

### Basic Functionality
- [ ] App loads on phone browser
- [ ] Can install to home screen (PWA)
- [ ] App opens from home screen (full screen, no browser bar)
- [ ] Profile switcher works
- [ ] Can switch between profiles

### Camera Flow
- [ ] "Take Photo" opens camera directly (not file picker)
- [ ] Can take photo of a product (test with something from your pantry)
- [ ] Photo preview shows correctly
- [ ] Text extraction works
- [ ] Can edit extracted text
- [ ] Submit works

### Verdicts
- [ ] Create test profile with peanut allergy
- [ ] Photo a peanut product → HIGH RISK
- [ ] Photo something safe → SAFE
- [ ] Check Shajey profile with Eliquis
- [ ] Photo fish oil bottle → MEDIUM RISK

### UX Issues to Note
- [ ] Any text too small to read?
- [ ] Any buttons hard to tap?
- [ ] Any horizontal scrolling?
- [ ] Any layout broken?
- [ ] Loading states clear?
- [ ] Error messages helpful?

**After testing, share feedback and we'll iterate before Walgreens.**

---

## Out of Scope (Phase 18)

- Full offline support (queued checks, sync later)
- Push notifications
- App store submission (native wrapper)
- Barcode scanning
- Voice input

---

## Completion Checklist

### PWA Setup
- [ ] `manifest.json` created with correct icons
- [ ] Icons created (at least 192x192 and 512x512)
- [ ] Meta tags added to `index.html`
- [ ] Service worker created and registered

### Camera
- [ ] Camera opens directly on mobile (`capture="environment"`)
- [ ] Camera permission errors handled gracefully
- [ ] Both "Take Photo" and "Upload" options available

### UI Polish
- [ ] UI readable on mobile without issues
- [ ] Touch targets adequate (44x44px minimum)
- [ ] No horizontal scroll
- [ ] Loading states clear

### Deployment
- [ ] Environment variables set in Vercel Dashboard
- [ ] Migration run on production Supabase
- [ ] Deployed to production (`vercel --prod`)
- [ ] Production URL works

### Testing
- [ ] PWA installable on phone
- [ ] Camera works on phone
- [ ] All acceptance tests pass on real phone
- [ ] UX feedback collected for iteration
