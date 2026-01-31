/**
 * Panel CSS as a TypeScript module for injection.
 * All selectors are prefixed with .twitter-translator-panel to avoid conflicts with Twitter.
 */

export const PANEL_STYLES = `
/* Twitter Translator Side Panel */
.twitter-translator-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 450px;
  min-width: 360px;
  max-width: min(80vw, 720px);
  height: 100vh;
  background: var(--tt-bg, #ffffff);
  border-left: 1px solid var(--tt-border, #eff3f4);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  transform: translateX(100%);
  transition: transform 0.3s ease-out;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
  resize: horizontal;
  overflow: auto;

  /* CSS Custom Properties for theming */
  --tt-bg: #ffffff;
  --tt-bg-accent: #f7f9fa;
  --tt-surface: #ffffff;
  --tt-surface-muted: #f7f9fa;
  --tt-text: #0f1419;
  --tt-muted: #536471;
  --tt-border: #eff3f4;
  --tt-border-strong: #e3e8ea;
  --tt-accent: #1d9bf0;
  --tt-accent-strong: #1a8cd8;
  --tt-warning: #b45309;
  --tt-warning-bg: #fef3c7;
}

/* Resize Handle */
.twitter-translator-panel .panel-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  background: transparent;
  z-index: 1;
}

.twitter-translator-panel .panel-resize-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 2px;
  width: 4px;
  height: 48px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: rgba(29, 155, 240, 0.35);
  opacity: 0;
  transition: opacity 0.2s;
}

.twitter-translator-panel .panel-resize-handle:hover::after,
.twitter-translator-panel .panel-resize-handle:active::after,
body.tt-panel-resizing .twitter-translator-panel .panel-resize-handle::after {
  opacity: 1;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .twitter-translator-panel {
    --tt-bg: #000000;
    --tt-bg-accent: #16181c;
    --tt-surface: #000000;
    --tt-surface-muted: #16181c;
    --tt-text: #e7e9ea;
    --tt-muted: #71767b;
    --tt-border: #2f3336;
    --tt-border-strong: #2f3336;
    --tt-accent: #1d9bf0;
    --tt-accent-strong: #1a8cd8;
    --tt-warning: #f59e0b;
    --tt-warning-bg: #1f1406;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.4);
  }
}

.twitter-translator-panel.panel-open {
  transform: translateX(0);
}

.twitter-translator-panel * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Panel Header */
.twitter-translator-panel .panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--tt-border);
  background: var(--tt-surface);
  flex-shrink: 0;
}

.twitter-translator-panel .panel-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--tt-text);
}

.twitter-translator-panel .panel-close-btn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--tt-text);
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.twitter-translator-panel .panel-close-btn:hover {
  background: rgba(29, 155, 240, 0.1);
}

/* Panel Content */
.twitter-translator-panel .panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  background: var(--tt-bg);
}

/* Panel Footer */
.twitter-translator-panel .panel-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--tt-border);
  background: var(--tt-surface);
  font-size: 13px;
  color: var(--tt-muted);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.twitter-translator-panel .panel-footer-usage {
  font-size: 13px;
  color: var(--tt-muted);
}

.twitter-translator-panel .panel-load-more {
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  color: var(--tt-text);
  border-radius: 9999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.twitter-translator-panel .panel-load-more:hover:enabled {
  background: var(--tt-bg-accent);
  color: var(--tt-accent);
}

.twitter-translator-panel .panel-load-more:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Loading State */
.twitter-translator-panel .panel-loading {
  text-align: center;
  padding: 32px 16px;
  color: var(--tt-muted);
}

.twitter-translator-panel .panel-loading::before {
  content: '';
  display: block;
  width: 40px;
  height: 40px;
  border: 3px solid var(--tt-border);
  border-top-color: var(--tt-accent);
  border-radius: 50%;
  animation: tt-spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes tt-spin {
  to { transform: rotate(360deg); }
}

/* Error State */
.twitter-translator-panel .panel-error {
  background: var(--tt-warning-bg);
  border: 1px solid #ffb74d;
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--tt-warning);
  margin: 16px;
}

/* Empty State */
.twitter-translator-panel .panel-empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--tt-muted);
  font-size: 15px;
}

.twitter-translator-panel .panel-empty::before {
  content: '[ ]';
  display: block;
  font-size: 32px;
  margin-bottom: 16px;
}

/* Tweet Cards (scoped) */
.twitter-translator-panel .tweet-card {
  background: var(--tt-surface);
  padding: 16px;
  border-bottom: 1px solid var(--tt-border);
  position: relative;
  --gutter-left: 36px;
  --gutter-top: 68px;
  transition: background 0.2s;
}

/* Reply Thread Connectors */
.twitter-translator-panel .tweet-card.group-start {
  border-top: 1px solid var(--tt-border);
}

.twitter-translator-panel .tweet-card.gutter-start::after,
.twitter-translator-panel .tweet-card.gutter-middle::after,
.twitter-translator-panel .tweet-card.gutter-end::after {
  content: '';
  position: absolute;
  left: var(--gutter-left);
  width: 2px;
  background: var(--tt-border);
  z-index: 0;
}

.twitter-translator-panel .tweet-card.gutter-start::after {
  top: var(--gutter-top);
  bottom: 0;
}

.twitter-translator-panel .tweet-card.gutter-middle::after {
  top: 0;
  bottom: 0;
}

.twitter-translator-panel .tweet-card.gutter-end::after {
  top: 0;
  height: var(--gutter-top);
}

.twitter-translator-panel .tweet-card:hover {
  background: var(--tt-bg-accent);
}

.twitter-translator-panel .tweet-card.inline-reply {
  margin-left: 28px;
  border-left: 2px solid var(--tt-border);
  --gutter-left: 8px;
  padding-left: 14px;
}

.twitter-translator-panel .tweet-shell {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  align-items: start;
  position: relative;
  z-index: 1;
}

.twitter-translator-panel .tweet-avatar {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--tt-accent);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.3px;
}

.twitter-translator-panel .tweet-body {
  min-width: 0;
}

.twitter-translator-panel .tweet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  font-size: 15px;
}

.twitter-translator-panel .tweet-header::after {
  content: "v";
  font-size: 12px;
  color: var(--tt-muted);
  transition: transform 0.2s;
}

.twitter-translator-panel .tweet-card.expanded .tweet-header::after {
  transform: rotate(180deg);
}

.twitter-translator-panel .tweet-author {
  font-weight: 700;
  color: var(--tt-text);
}

.twitter-translator-panel .tweet-timestamp {
  font-size: 15px;
  color: var(--tt-muted);
  white-space: nowrap;
}

.twitter-translator-panel .tweet-translation {
  font-size: 15px;
  margin-bottom: 6px;
  color: var(--tt-text);
  white-space: pre-wrap;
}

.twitter-translator-panel .tweet-original {
  font-size: 14px;
  color: var(--tt-muted);
  padding-top: 8px;
  border-top: 1px solid var(--tt-border);
  white-space: pre-wrap;
}

.twitter-translator-panel .tweet-actions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.twitter-translator-panel .tweet-action-btn {
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  color: var(--tt-text);
  border-radius: 9999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.twitter-translator-panel .tweet-action-btn:hover {
  background: var(--tt-bg-accent);
  color: var(--tt-accent);
}

/* Breakdown */
.twitter-translator-panel .tweet-breakdown {
  margin-top: 16px;
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.3s ease-out, opacity 0.2s ease-out;
  justify-items: center;
}

.twitter-translator-panel .tweet-breakdown:not(.hidden) {
  grid-template-rows: 1fr;
  opacity: 1;
}

.twitter-translator-panel .tweet-breakdown > .breakdown-inner {
  overflow: auto;
  padding: 16px;
  background: var(--tt-surface-muted);
  border-radius: 12px;
  border: 1px solid var(--tt-border-strong);
  width: 100%;
  max-width: 100%;
}

.twitter-translator-panel .breakdown-loading,
.twitter-translator-panel .breakdown-error {
  padding: 20px;
  text-align: center;
  color: var(--tt-muted);
  font-size: 14px;
}

.twitter-translator-panel .breakdown-error {
  color: var(--tt-warning);
  background: var(--tt-warning-bg);
  border-radius: 8px;
}

.twitter-translator-panel .segment-table-wrapper {
  overflow-x: auto;
  margin-bottom: 16px;
  border-radius: 10px;
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
}

.twitter-translator-panel .segment-table {
  border-collapse: collapse;
  min-width: max-content;
}

.twitter-translator-panel .segment-table td {
  padding: 8px 16px;
  text-align: center;
  border: 1px solid var(--tt-border);
  white-space: nowrap;
}

.twitter-translator-panel .chinese-row td {
  font-size: 20px;
  font-weight: 500;
  background: var(--tt-surface-muted);
}

.twitter-translator-panel .pinyin-row td {
  font-size: 14px;
  color: var(--tt-accent);
  font-style: italic;
}

.twitter-translator-panel .gloss-row td {
  font-size: 13px;
  color: var(--tt-muted);
}

.twitter-translator-panel .notes-section {
  background: var(--tt-surface);
  border-radius: 10px;
  padding: 12px 16px;
  border: 1px solid var(--tt-border);
}

.twitter-translator-panel .notes-section h4 {
  font-size: 13px;
  color: var(--tt-muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.twitter-translator-panel .notes-section ul {
  list-style: none;
}

.twitter-translator-panel .notes-section li {
  font-size: 14px;
  padding: 4px 0;
  padding-left: 16px;
  position: relative;
  color: var(--tt-text);
}

.twitter-translator-panel .notes-section li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 10px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tt-accent);
}

.twitter-translator-panel .hidden {
  display: none !important;
}

/* Save Icons and Buttons */
.twitter-translator-panel .save-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--tt-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, color 0.2s, transform 0.2s;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.twitter-translator-panel .save-icon:hover {
  color: var(--tt-accent);
  background: rgba(29, 155, 240, 0.1);
}

.twitter-translator-panel .save-icon.saved {
  color: var(--tt-accent);
  opacity: 1;
}

.twitter-translator-panel .chinese-row td {
  position: relative;
}

.twitter-translator-panel .chinese-row td:hover .save-icon {
  opacity: 1;
}

.twitter-translator-panel .save-btn {
  border: 1px solid var(--tt-border);
  background: var(--tt-surface);
  color: var(--tt-text);
  border-radius: 9999px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.twitter-translator-panel .save-btn:hover {
  background: var(--tt-bg-accent);
  color: var(--tt-accent);
}

.twitter-translator-panel .save-btn.saved {
  color: var(--tt-accent);
  border-color: var(--tt-accent);
  background: rgba(29, 155, 240, 0.1);
}

.twitter-translator-panel .segment-table-wrapper {
  position: relative;
}

.twitter-translator-panel .save-sentence-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

/* Skeleton Loading */
.twitter-translator-panel .skeleton {
  background: var(--tt-bg-accent);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.twitter-translator-panel .skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.08) 50%,
    transparent 100%
  );
  animation: tt-shimmer 1.5s ease-in-out infinite;
}

@keyframes tt-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .twitter-translator-panel,
  .twitter-translator-panel *,
  .twitter-translator-panel *::before,
  .twitter-translator-panel *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Mobile / Small Viewport Support */
@media (max-width: 720px) {
  .twitter-translator-panel {
    left: 0;
    right: 0;
    width: 100vw;
    min-width: 100vw;
    max-width: 100vw;
    border-left: none;
    box-shadow: none;
    resize: none;
  }

  .twitter-translator-panel .panel-resize-handle {
    display: none;
  }

  .twitter-translator-panel .panel-header {
    padding-top: calc(12px + env(safe-area-inset-top));
    padding-left: calc(16px + env(safe-area-inset-left));
    padding-right: calc(16px + env(safe-area-inset-right));
  }

  .twitter-translator-panel .panel-content {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .twitter-translator-panel .panel-footer {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    padding-left: calc(16px + env(safe-area-inset-left));
    padding-right: calc(16px + env(safe-area-inset-right));
  }

  .twitter-translator-panel .panel-close-btn,
  .twitter-translator-panel .panel-load-more,
  .twitter-translator-panel .tweet-action-btn,
  .twitter-translator-panel .save-btn,
  .twitter-translator-panel .save-icon {
    min-width: 44px;
    min-height: 44px;
  }
}
`;

/**
 * Injects the panel styles into the document.
 * Idempotent - only injects once.
 */
export function injectPanelStyles(): void {
  if (document.getElementById('twitter-translator-panel-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'twitter-translator-panel-styles';
  style.textContent = PANEL_STYLES;
  document.head.appendChild(style);
}

/**
 * Removes the panel styles from the document.
 */
export function removePanelStyles(): void {
  const style = document.getElementById('twitter-translator-panel-styles');
  if (style) {
    style.remove();
  }
}



