# goodr Promo Popup – Shopify Theme Section

A configurable, accessible promotional popup built as a Shopify theme section.  
Supports delay or scroll triggers, persisted dismissal, responsive layout, and production-safe scoped CSS/JS.

---

## Files
sections/goodr-popup.liquid
assets/popup.css
assets/popup.js
assets/x.svg
assets/goodr_logo_white.svg

---

## Install

### Prerequisites
- Access to a Shopify store (development or production)
- Permission to edit themes

### Install the Popup Section

1. Log in to **Shopify Admin**
2. Navigate to **Online Store → Themes**
3. Locate the target theme
4. Click **⋯ (...)** → **Edit code**

**Add the section**

Drag the `popup.liquid` file to the **Sections** folder.

**Add required assets**

Drag the following files to the **Assets** folder:
    - `popup.css`
    - `popup.js`
    - `x.svg`
    - `goodr_logo_white.svg`

---

## Enable

1. Shopify Admin → **Online Store → Themes → Edit Theme**
2. Navigate to the target page
3. **Add section** → **goodr Promo Popup**

The popup is now active on that page.

---

## Configuration (Theme Editor)

- **Popup image** – main visual
- **Promo code** – highlighted discount
- **CTA link** – destination URL
- **Trigger**
  - `After delay`
  - `On scroll`
- **Delay (ms)** – used when trigger = delay
- **Scroll percentage** – used when trigger = scroll
- **Dismiss duration (hours)**
  - `0` = show every visit
  - `>0` = hide after dismiss for N hours

Triggers are mutually exclusive by design.

---

## Behavior

- Opens via configured trigger
- Dismisses on:
  - Close button
  - Overlay click
  - Secondary action
  - ESC key
- Optional persisted dismissal via `localStorage`
- Keyboard accessible with focus trapping
- No layout shift (CLS-safe)

---

## Integration Stub

`popup.js` includes an integration stub for analytics:

```js
#track('popup_opened', { trigger, reason });
#track('popup_dismissed', { reason });
```

---

## Tradeoffs

- CSS values are not a 1-to-1 match with Figma measurements  
  - Minor adjustments were made to proportions to ensure consistent rendering and responsiveness across breakpoints
- The exact font used in Figma was not available, so a close system/web-safe alternative was used
- Content copy and certain visual elements (e.g. button text, brand overlay) are not configurable via section settings but could be exposed with additional configuration

## Assumptions

- Images use `object-fit: cover` to fill the available container while preserving aspect ratio
- A single image asset is sufficient across breakpoints; responsive image variants could be introduced if different mobile/desktop imagery is required