# UI/UX Requirements: Twitter/X Design Alignment

This document outlines the requirements for bringing the Twitter Translator extension's UI/UX into alignment with the current Twitter/X web interface design system.

## Research Sources

- [Twitter Dark Mode Color Palette](https://www.color-hex.com/color-palette/99156)
- [Twitter Colors - U.S. Brand Colors](https://usbrandcolors.com/twitter-colors/)
- [50 Shades of Dark Mode Gray](https://blog.karenying.com/posts/50-shades-of-dark-mode-gray/)
- [Twitter Font Analysis - FontsArena](https://fontsarena.com/blog/what-font-does-twitter-use/)
- [X Twitter Style UI Animation - Rive](https://rive.app/marketplace/20408-38378-x-twitter-style-ui-animation-interactive-microblogging-effect/)
- [Twitter Floating to Fixed Transition - Waveguide](https://www.waveguide.io/examples/entry/floating-to-fixed-transition/)

---

## 1. Color System

### Current Issues
- Dark mode uses custom blue-tinted grays (`#0b0f14`, `#141c26`) that don't match Twitter
- Popup uses gradient backgrounds (Twitter doesn't use gradients)
- Some accent colors are slightly off

### Required Changes

#### Light Mode
| Token | Current | Required | Usage |
|-------|---------|----------|-------|
| `--bg` | `#ffffff` | `#ffffff` | Main background |
| `--bg-secondary` | `#f7f9fa` | `#f7f9f9` | Secondary background |
| `--text-primary` | `#0f1419` | `#0f1419` | Primary text (correct) |
| `--text-secondary` | `#536471` | `#536471` | Muted/secondary text (correct) |
| `--border` | `#eff3f4` | `#eff3f4` | Dividers and borders (correct) |
| `--accent` | `#1d9bf0` | `#1d9bf0` | Primary blue accent (correct) |
| `--accent-hover` | `#1a8cd8` | `#1a8cd8` | Blue on hover |

#### Dark Mode ("Lights Out" - Pure Black)
| Token | Current | Required | Usage |
|-------|---------|----------|-------|
| `--bg` | `#000000` | `#000000` | Main background (correct) |
| `--bg-secondary` | `#0b0f14` | `#16181c` | Secondary/elevated background |
| `--text-primary` | `#e7e9ea` | `#e7e9ea` | Primary text (correct) |
| `--text-secondary` | `#71767b` | `#71767b` | Muted text (correct) |
| `--border` | `#2f3336` | `#2f3336` | Dividers (correct) |

#### Dark Mode Alternative ("Dim" - Blue-tinted)
Consider supporting this as an alternative theme:
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#15202b` | Main background |
| `--bg-secondary` | `#192734` | Card/elevated surfaces |
| `--border` | `#38444d` | Dividers |

---

## 2. Typography

### Current Issues
- Font stack uses `"Helvetica Neue", "Segoe UI", Arial` but Twitter uses Chirp
- Some font sizes don't match Twitter's type scale
- Line heights need adjustment

### Required Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

Note: Chirp is Twitter's proprietary font and cannot be used. The above fallback stack is what Twitter uses for non-Chirp browsers.

### Type Scale
| Element | Current | Required | Weight |
|---------|---------|----------|--------|
| Page title (h1) | 20px | 20px | 800 (extra bold) |
| Tweet author | 15px | 15px | 700 |
| Tweet body | 16px | 15px | 400 |
| Tweet timestamp | 13px | 15px | 400 |
| Secondary text | 14px | 13px | 400 |
| Button text | 14px | 15px | 700 |
| Small labels | 12px | 13px | 400 |

### Line Heights
- Body text: 20px (1.3125 ratio for 15px text)
- Headlines: 24px

---

## 3. Spacing System

### Current Issues
- Inconsistent spacing values
- Tweet cards use different padding than Twitter

### Required Spacing Scale (4px base)
```
4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px
```

### Component Spacing
| Component | Current | Required |
|-----------|---------|----------|
| Tweet card padding | 16px | 12px horizontal, 12px vertical |
| Avatar to content gap | 12px | 12px (correct) |
| Header sticky padding | 12px 16px | 8px 16px |
| Section dividers | 1px border | 1px border (correct) |

---

## 4. Border Radius

### Current Issues
- Using 10px, 12px which don't match Twitter's system
- Some elements need full rounding

### Required Values
| Usage | Current | Required |
|-------|---------|----------|
| Buttons (primary) | 10px | 9999px (full pill) |
| Cards/containers | 12px | 16px |
| Input fields | 8px | 4px |
| Avatars | 999px | 9999px (correct - full circle) |
| Small elements | varies | 4px |
| Tooltips/modals | varies | 16px |

---

## 5. Shadows and Elevation

### Current Issues
- Popup uses prominent shadows
- Twitter uses minimal to no shadows

### Required Changes
- **Remove** gradient backgrounds from popup
- **Reduce** shadow intensity significantly
- Twitter primarily uses borders and subtle background color changes for elevation

```css
/* Remove or minimize */
--shadow: none;  /* Twitter rarely uses shadows */

/* If shadow is needed (modals, dropdowns): */
--shadow-popup: rgba(101, 119, 134, 0.2) 0px 0px 15px,
                rgba(101, 119, 134, 0.15) 0px 0px 3px 1px;
```

---

## 6. Button Styles

### Current Issues
- Buttons have 10px border radius (should be pill-shaped)
- Secondary buttons have visible borders
- Missing proper hover/active states

### Primary Button
```css
.btn-primary {
  background: #1d9bf0;
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  padding: 0 16px;
  height: 36px;
  font-weight: 700;
  font-size: 15px;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background: #1a8cd8;
}

.btn-primary:active {
  background: #1a8cd8;
  transform: scale(0.96);
}
```

### Secondary/Outline Button
```css
.btn-secondary {
  background: transparent;
  color: #0f1419; /* or #e7e9ea in dark mode */
  border: 1px solid #cfd9de; /* or #536471 in dark mode */
  border-radius: 9999px;
  padding: 0 16px;
  height: 36px;
  font-weight: 700;
  font-size: 15px;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background: rgba(15, 20, 25, 0.1); /* or rgba(239, 243, 244, 0.1) in dark */
}
```

---

## 7. Tweet Card Layout

### Current Issues
- Grid uses 48px column for avatar area (Twitter uses 40px avatar)
- Expand/collapse chevron pattern differs from Twitter
- Missing reply thread connector lines

### Required Layout
```
[Avatar 40px] [12px gap] [Content - flexible]

Avatar: 40x40px circle
Gap: 12px
Content: flex-grow
```

### Reply Thread Connectors
Twitter uses vertical lines to connect reply threads:
```css
.reply-connector {
  position: absolute;
  left: 20px; /* center of avatar */
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border);
}
```

---

## 8. Animations and Transitions

### Current Issues
- Limited hover feedback
- No loading skeleton states
- Expand/collapse is instant

### Required Transitions
```css
/* Standard hover transition */
transition: background-color 0.2s ease-out;

/* Button press */
transition: transform 0.1s ease-out;

/* Expand/collapse content */
transition: height 0.3s ease-out, opacity 0.2s ease-out;

/* Loading spinner */
animation: spin 1s linear infinite;
```

### Hover States
All interactive elements should have visible hover feedback:
- Buttons: Background color change
- Tweet cards: `background: rgba(0, 0, 0, 0.03)` (light) or `rgba(255, 255, 255, 0.03)` (dark)
- Links: Underline on hover
- Icon buttons: Circular background highlight

---

## 9. Loading States

### Current Issues
- Simple spinner with text
- No skeleton loading states

### Required Changes
Add skeleton loading for tweet cards:
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 0%,
    var(--bg) 50%,
    var(--bg-secondary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 10. Header/Navigation

### Current Issues
- Back button uses CSS-drawn arrow
- Header could match Twitter's sticky header pattern more closely

### Required Changes
- Use proper SVG icon for back arrow (matches Twitter's iconography)
- Add blur effect to sticky header background
- Header height: 53px

```css
.header {
  position: sticky;
  top: 0;
  height: 53px;
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.85); /* light */
  /* background: rgba(0, 0, 0, 0.65); dark */
  border-bottom: 1px solid var(--border);
  z-index: 10;
}
```

### Back Button Icon (SVG)
```html
<svg viewBox="0 0 24 24" width="20" height="20">
  <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" fill="currentColor"/>
</svg>
```

---

## 11. Popup UI

### Current Issues
- Uses gradient background (non-Twitter pattern)
- Card styling differs from Twitter
- Form inputs don't match Twitter's style

### Required Changes

#### Remove Gradients
```css
body {
  background: var(--bg); /* solid color, no gradient */
}
```

#### Input Fields
```css
input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 12px;
  font-size: 15px;
  color: var(--text-primary);
}

input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
```

---

## 12. Breakdown/Detail View

### Current Issues
- Segment table styling differs from Twitter's table patterns
- Notes section could better match Twitter's card style

### Required Changes
- Simplify table borders
- Use subtle background alternation instead of heavy borders
- Match Twitter's information card pattern

---

## 13. Accessibility

### Requirements
- All interactive elements must have visible focus states
- Focus ring: `box-shadow: 0 0 0 2px var(--accent)`
- Minimum touch target: 44x44px for mobile
- Color contrast ratios must meet WCAG AA (4.5:1 for text)

---

## 14. Responsive Behavior

### Translation Page
- Max width: 600px (matches Twitter's column width)
- Center content on larger screens
- Full width on mobile

### Popup
- Fixed width: 320px (current is correct)

---

## Implementation Priority

### Phase 1 - Critical Visual Alignment
1. Update color system (dark mode especially)
2. Fix button styles (pill shape)
3. Remove gradients from popup
4. Update font stack and type scale

### Phase 2 - Component Refinement
5. Update border radius values
6. Improve tweet card layout
7. Add reply thread connectors
8. Update header/navigation

### Phase 3 - Polish
9. Add skeleton loading states
10. Improve animations/transitions
11. Refine hover states
12. Add blur effects to header

---

## Testing Checklist

- [ ] Light mode matches Twitter light theme
- [ ] Dark mode matches Twitter "Lights Out" theme
- [ ] Buttons appear pill-shaped
- [ ] Tweet cards have correct padding and spacing
- [ ] Hover states work on all interactive elements
- [ ] Loading states appear smooth
- [ ] No gradients visible in popup
- [ ] Typography matches Twitter's scale
- [ ] Focus states are visible for keyboard navigation
