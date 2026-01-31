import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SidePanel, createPanel, destroyPanel, isPanelOpen, togglePanel } from './panel';
import { injectPanelStyles, removePanelStyles, PANEL_STYLES } from './panel.css';

describe('SidePanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    destroyPanel();
  });

  describe('Panel Creation and Destruction', () => {
    it('creates a panel container element', () => {
      const panel = createPanel();
      expect(panel).toBeDefined();
      expect(panel instanceof HTMLElement).toBe(true);
    });

    it('panel has correct class name for scoping styles', () => {
      const panel = createPanel();
      expect(panel.classList.contains('twitter-translator-panel')).toBe(true);
    });

    it('panel is appended to document body', () => {
      const panel = createPanel();
      expect(document.body.contains(panel)).toBe(true);
    });

    it('destroyPanel removes panel from DOM', () => {
      const panel = createPanel();
      expect(document.body.contains(panel)).toBe(true);
      destroyPanel();
      expect(document.body.querySelector('.twitter-translator-panel')).toBeNull();
    });

    it('createPanel is idempotent - only one panel exists', () => {
      createPanel();
      createPanel();
      const panels = document.querySelectorAll('.twitter-translator-panel');
      expect(panels.length).toBe(1);
    });
  });

  describe('Panel Open/Close', () => {
    it('panel starts hidden by default', () => {
      const panel = createPanel();
      expect(isPanelOpen()).toBe(false);
      expect(panel.classList.contains('panel-open')).toBe(false);
    });

    it('togglePanel opens a closed panel', () => {
      createPanel();
      expect(isPanelOpen()).toBe(false);
      togglePanel();
      expect(isPanelOpen()).toBe(true);
    });

    it('togglePanel closes an open panel', () => {
      createPanel();
      togglePanel(); // open
      expect(isPanelOpen()).toBe(true);
      togglePanel(); // close
      expect(isPanelOpen()).toBe(false);
    });

    it('panel has panel-open class when open', () => {
      const panel = createPanel();
      togglePanel();
      expect(panel.classList.contains('panel-open')).toBe(true);
    });
  });

  describe('Panel Structure', () => {
    it('panel has a close button', () => {
      const panel = createPanel();
      const closeBtn = panel.querySelector('.panel-close-btn');
      expect(closeBtn).not.toBeNull();
    });

    it('clicking close button closes the panel', () => {
      const panel = createPanel();
      togglePanel(); // open
      expect(isPanelOpen()).toBe(true);

      const closeBtn = panel.querySelector('.panel-close-btn') as HTMLElement;
      closeBtn.click();
      expect(isPanelOpen()).toBe(false);
    });

    it('panel has a header element', () => {
      const panel = createPanel();
      const header = panel.querySelector('.panel-header');
      expect(header).not.toBeNull();
    });

    it('panel has a content container', () => {
      const panel = createPanel();
      const content = panel.querySelector('.panel-content');
      expect(content).not.toBeNull();
    });

    it('panel has a footer element', () => {
      const panel = createPanel();
      const footer = panel.querySelector('.panel-footer');
      expect(footer).not.toBeNull();
    });
  });

  describe('Panel Positioning', () => {
    it('panel has fixed positioning', () => {
      const panel = createPanel();
      // We'll check that the element has the right class that applies fixed positioning
      expect(panel.classList.contains('twitter-translator-panel')).toBe(true);
    });

    it('panel has appropriate z-index class', () => {
      const panel = createPanel();
      // Panel should be above Twitter content
      expect(panel.classList.contains('twitter-translator-panel')).toBe(true);
    });
  });

  describe('SidePanel Class', () => {
    it('SidePanel instance can be created', () => {
      const panel = new SidePanel();
      expect(panel).toBeDefined();
    });

    it('SidePanel.open() opens the panel', () => {
      const panel = new SidePanel();
      panel.open();
      expect(panel.isOpen()).toBe(true);
    });

    it('SidePanel.close() closes the panel', () => {
      const panel = new SidePanel();
      panel.open();
      panel.close();
      expect(panel.isOpen()).toBe(false);
    });

    it('SidePanel.toggle() toggles the panel state', () => {
      const panel = new SidePanel();
      expect(panel.isOpen()).toBe(false);
      panel.toggle();
      expect(panel.isOpen()).toBe(true);
      panel.toggle();
      expect(panel.isOpen()).toBe(false);
    });

    it('SidePanel.destroy() removes the panel from DOM', () => {
      const panel = new SidePanel();
      panel.open();
      expect(document.body.querySelector('.twitter-translator-panel')).not.toBeNull();
      panel.destroy();
      expect(document.body.querySelector('.twitter-translator-panel')).toBeNull();
    });

    it('SidePanel.getContentContainer() returns the content element', () => {
      const panel = new SidePanel();
      const content = panel.getContentContainer();
      expect(content).not.toBeNull();
      expect(content?.classList.contains('panel-content')).toBe(true);
    });

    it('SidePanel.setContent() sets content in the panel', () => {
      const panel = new SidePanel();
      const testContent = document.createElement('div');
      testContent.textContent = 'Test content';
      panel.setContent(testContent);

      const content = panel.getContentContainer();
      expect(content?.contains(testContent)).toBe(true);
    });

    it('SidePanel.showLoading() displays loading state', () => {
      const panel = new SidePanel();
      panel.showLoading(true);
      const content = panel.getContentContainer();
      expect(content?.querySelector('.panel-loading')).not.toBeNull();
    });

    it('SidePanel.showLoading(false) hides loading state', () => {
      const panel = new SidePanel();
      panel.showLoading(true);
      panel.showLoading(false);
      const content = panel.getContentContainer();
      expect(content?.querySelector('.panel-loading')).toBeNull();
    });

    it('SidePanel.showError() displays error message', () => {
      const panel = new SidePanel();
      panel.showError('Test error message');
      const content = panel.getContentContainer();
      const errorEl = content?.querySelector('.panel-error');
      expect(errorEl).not.toBeNull();
      expect(errorEl?.textContent).toContain('Test error message');
    });

    it('SidePanel.showEmptyState() displays empty state for non-thread pages', () => {
      const panel = new SidePanel();
      panel.showEmptyState();
      const content = panel.getContentContainer();
      const emptyEl = content?.querySelector('.panel-empty');
      expect(emptyEl).not.toBeNull();
      expect(emptyEl?.textContent).toContain('Navigate to a tweet');
    });
  });
});

describe('Panel Styles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  afterEach(() => {
    removePanelStyles();
  });

  it('PANEL_STYLES contains styles for the panel', () => {
    expect(PANEL_STYLES).toContain('.twitter-translator-panel');
    expect(PANEL_STYLES).toContain('position: fixed');
    expect(PANEL_STYLES).toContain('z-index: 9999');
  });

  it('injectPanelStyles adds style element to head', () => {
    injectPanelStyles();
    const style = document.getElementById('twitter-translator-panel-styles');
    expect(style).not.toBeNull();
    expect(style?.tagName).toBe('STYLE');
  });

  it('injectPanelStyles is idempotent', () => {
    injectPanelStyles();
    injectPanelStyles();
    const styles = document.querySelectorAll('#twitter-translator-panel-styles');
    expect(styles.length).toBe(1);
  });

  it('removePanelStyles removes style element from head', () => {
    injectPanelStyles();
    expect(document.getElementById('twitter-translator-panel-styles')).not.toBeNull();
    removePanelStyles();
    expect(document.getElementById('twitter-translator-panel-styles')).toBeNull();
  });

  it('PANEL_STYLES includes dark mode support', () => {
    expect(PANEL_STYLES).toContain('prefers-color-scheme: dark');
  });

  it('PANEL_STYLES includes reduced motion support', () => {
    expect(PANEL_STYLES).toContain('prefers-reduced-motion: reduce');
  });

  it('PANEL_STYLES includes mobile layout overrides', () => {
    expect(PANEL_STYLES).toContain('@media (max-width: 720px)');
  });

  it('PANEL_STYLES includes safe-area inset padding on mobile', () => {
    expect(PANEL_STYLES).toContain('env(safe-area-inset-top)');
    expect(PANEL_STYLES).toContain('env(safe-area-inset-bottom)');
  });

  it('PANEL_STYLES enforces 44px touch targets on mobile', () => {
    expect(PANEL_STYLES).toContain('min-height: 44px');
    expect(PANEL_STYLES).toContain('min-width: 44px');
  });
});
