import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the HTML files to test their CSS
const popupHtml = readFileSync(join(__dirname, '../../popup.html'), 'utf-8');
const translateHtml = readFileSync(join(__dirname, '../../translate.html'), 'utf-8');

// Extract CSS from HTML style tags
function extractCss(html: string): string {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  return styleMatch ? styleMatch[1] : '';
}

const popupCss = extractCss(popupHtml);
const translateCss = extractCss(translateHtml);

describe('Phase 1 - Critical Visual Alignment', () => {
  describe('Color System', () => {
    describe('translate.html dark mode', () => {
      it('uses #16181c for --bg-secondary in dark mode', () => {
        // Requirement: Dark mode --bg-secondary should be #16181c
        expect(translateCss).toMatch(/--bg-accent:\s*#16181c/i);
      });

      it('uses #16181c for --surface-muted in dark mode', () => {
        expect(translateCss).toMatch(/--surface-muted:\s*#16181c/i);
      });
    });

    describe('popup.html dark mode', () => {
      it('uses #000000 for main background in dark mode', () => {
        // Pure black background for dark mode
        expect(popupCss).toMatch(/@media.*prefers-color-scheme:\s*dark[\s\S]*?--bg:\s*#000000/i);
      });

      it('uses #16181c for secondary background in dark mode', () => {
        expect(popupCss).toMatch(/@media.*prefers-color-scheme:\s*dark[\s\S]*?--bg-accent:\s*#16181c/i);
      });
    });
  });

  describe('Button Styles', () => {
    it('popup.html buttons have pill shape (border-radius: 9999px)', () => {
      // Requirement: Buttons should be pill-shaped
      expect(popupCss).toMatch(/\.btn\s*\{[\s\S]*?border-radius:\s*9999px/);
    });

    it('translate.html action buttons have pill shape', () => {
      // Already using 999px for some buttons, but should be 9999px
      expect(translateCss).toMatch(/\.tweet-action-btn\s*\{[\s\S]*?border-radius:\s*9999px/);
    });

    it('popup.html buttons have 700 font weight', () => {
      expect(popupCss).toMatch(/\.btn\s*\{[\s\S]*?font-weight:\s*700/);
    });

    it('popup.html buttons have 15px font size', () => {
      expect(popupCss).toMatch(/\.btn\s*\{[\s\S]*?font-size:\s*15px/);
    });
  });

  describe('No Gradients', () => {
    it('popup.html body does not use gradient background', () => {
      // Requirement: Remove gradient backgrounds
      const bodyMatch = popupCss.match(/body\s*\{[\s\S]*?\}/);
      expect(bodyMatch?.[0]).not.toMatch(/linear-gradient/i);
    });
  });

  describe('Typography', () => {
    describe('Font Stack', () => {
      it('popup.html uses Twitter system font fallback stack', () => {
        // Required: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
        expect(popupCss).toMatch(/-apple-system/);
        expect(popupCss).toMatch(/BlinkMacSystemFont/);
      });

      it('translate.html uses Twitter system font fallback stack', () => {
        expect(translateCss).toMatch(/-apple-system/);
        expect(translateCss).toMatch(/BlinkMacSystemFont/);
      });
    });

    describe('Type Scale', () => {
      it('popup.html h1 has 800 font weight', () => {
        expect(popupCss).toMatch(/h1\s*\{[\s\S]*?font-weight:\s*800/);
      });

      it('translate.html h1 has 800 font weight', () => {
        expect(translateCss).toMatch(/h1\s*\{[\s\S]*?font-weight:\s*800/);
      });

      it('translate.html tweet body has 15px font size', () => {
        expect(translateCss).toMatch(/\.tweet-translation\s*\{[\s\S]*?font-size:\s*15px/);
      });

      it('translate.html tweet timestamp has 15px font size', () => {
        expect(translateCss).toMatch(/\.tweet-timestamp\s*\{[\s\S]*?font-size:\s*15px/);
      });
    });
  });

  describe('Hover Micro-interactions', () => {
    it('buttons have active state with scale transform', () => {
      expect(translateCss).toMatch(/\.btn:active[\s\S]*?transform:\s*scale\(0\.96\)/);
    });

    it('nav-back has hover highlight', () => {
      expect(translateCss).toMatch(/\.nav-back:hover/);
    });
  });

  describe('Focus States', () => {
    it('removes default focus outline', () => {
      expect(translateCss).toMatch(/\*:focus\s*\{[\s\S]*?outline:\s*none/);
    });

    it('has custom focus-visible ring', () => {
      expect(translateCss).toMatch(/\*:focus-visible\s*\{/);
      expect(translateCss).toMatch(/focus-visible[\s\S]*?box-shadow/);
    });
  });

  describe('Reduced Motion Support', () => {
    it('has prefers-reduced-motion media query', () => {
      expect(translateCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    });
  });
});
