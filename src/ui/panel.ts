/**
 * Side Panel for Twitter Translator
 * Renders as a right-side drawer overlaying Twitter content.
 */

import { clearElement } from './dom';

let panelInstance: HTMLElement | null = null;
let panelOpen = false;

/**
 * Creates the panel container element and appends it to the document body.
 * Idempotent - only creates one panel.
 */
export function createPanel(): HTMLElement {
  if (panelInstance) {
    return panelInstance;
  }

  const panel = document.createElement('div');
  panel.className = 'twitter-translator-panel';

  // Resize handle (left edge)
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'panel-resize-handle';
  resizeHandle.setAttribute('aria-hidden', 'true');
  panel.appendChild(resizeHandle);

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header';

  const title = document.createElement('h2');
  title.className = 'panel-title';
  title.textContent = 'Translate';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'panel-close-btn';
  closeBtn.type = 'button';
  closeBtn.textContent = 'x';
  closeBtn.setAttribute('aria-label', 'Close panel');
  closeBtn.addEventListener('click', () => {
    togglePanel();
  });
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // Content container
  const content = document.createElement('div');
  content.className = 'panel-content';
  panel.appendChild(content);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'panel-footer';
  const footerUsage = document.createElement('div');
  footerUsage.className = 'panel-footer-usage';
  footer.appendChild(footerUsage);
  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.className = 'panel-load-more';
  loadMoreBtn.type = 'button';
  loadMoreBtn.textContent = 'Load more replies';
  footer.appendChild(loadMoreBtn);
  panel.appendChild(footer);

  document.body.appendChild(panel);
  panelInstance = panel;

  const clampWidth = (value: number): number => {
    const minWidth = 360;
    const maxWidth = Math.min(window.innerWidth * 0.8, 720);
    return Math.max(minWidth, Math.min(maxWidth, value));
  };

  const startResize = (event: PointerEvent) => {
    event.preventDefault();
    resizeHandle.setPointerCapture(event.pointerId);
    document.body.classList.add('tt-panel-resizing');

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = clampWidth(window.innerWidth - moveEvent.clientX);
      panel.style.width = `${nextWidth}px`;
    };

    const stopResize = (upEvent: PointerEvent) => {
      resizeHandle.releasePointerCapture(upEvent.pointerId);
      document.body.classList.remove('tt-panel-resizing');
      resizeHandle.removeEventListener('pointermove', handleMove);
      resizeHandle.removeEventListener('pointerup', stopResize);
      resizeHandle.removeEventListener('pointercancel', stopResize);
    };

    resizeHandle.addEventListener('pointermove', handleMove);
    resizeHandle.addEventListener('pointerup', stopResize);
    resizeHandle.addEventListener('pointercancel', stopResize);
  };

  resizeHandle.addEventListener('pointerdown', startResize);

  return panel;
}

/**
 * Removes the panel from the DOM.
 */
export function destroyPanel(): void {
  if (panelInstance) {
    panelInstance.remove();
    panelInstance = null;
    panelOpen = false;
  }
}

/**
 * Returns whether the panel is currently open.
 */
export function isPanelOpen(): boolean {
  return panelOpen;
}

/**
 * Toggles the panel open/closed state.
 */
export function togglePanel(): void {
  if (!panelInstance) {
    return;
  }

  panelOpen = !panelOpen;
  panelInstance.classList.toggle('panel-open', panelOpen);
}

/**
 * SidePanel class for object-oriented usage.
 */
export class SidePanel {
  private element: HTMLElement;

  constructor() {
    this.element = createPanel();
  }

  /**
   * Opens the panel.
   */
  open(): void {
    if (!panelOpen) {
      togglePanel();
    }
  }

  /**
   * Closes the panel.
   */
  close(): void {
    if (panelOpen) {
      togglePanel();
    }
  }

  /**
   * Toggles the panel open/closed state.
   */
  toggle(): void {
    togglePanel();
  }

  /**
   * Returns whether the panel is open.
   */
  isOpen(): boolean {
    return isPanelOpen();
  }

  /**
   * Removes the panel from the DOM.
   */
  destroy(): void {
    destroyPanel();
  }

  /**
   * Returns the panel content container element.
   */
  getContentContainer(): HTMLElement | null {
    return this.element.querySelector('.panel-content');
  }

  /**
   * Sets the content of the panel.
   */
  setContent(content: HTMLElement | DocumentFragment): void {
    const container = this.getContentContainer();
    if (container) {
      clearElement(container);
      container.appendChild(content);
    }
  }

  /**
   * Shows or hides the loading state.
   */
  showLoading(show: boolean): void {
    const container = this.getContentContainer();
    if (!container) return;

    const existingLoading = container.querySelector('.panel-loading');

    if (show) {
      if (!existingLoading) {
        const loading = document.createElement('div');
        loading.className = 'panel-loading';
        loading.textContent = 'Loading...';
        container.appendChild(loading);
      }
    } else {
      existingLoading?.remove();
    }
  }

  /**
   * Shows an error message.
   */
  showError(message: string): void {
    const container = this.getContentContainer();
    if (!container) return;

    // Remove existing error
    container.querySelector('.panel-error')?.remove();

    const error = document.createElement('div');
    error.className = 'panel-error';
    error.textContent = message;
    container.appendChild(error);
  }

  /**
   * Shows the empty state for non-thread pages.
   */
  showEmptyState(): void {
    const container = this.getContentContainer();
    if (!container) return;

    clearElement(container);

    const empty = document.createElement('div');
    empty.className = 'panel-empty';
    empty.textContent = 'Navigate to a tweet to translate';
    container.appendChild(empty);
  }

  /**
   * Returns the panel footer element.
   */
  getFooter(): HTMLElement | null {
    return this.element.querySelector('.panel-footer');
  }

  getFooterUsage(): HTMLElement | null {
    return this.element.querySelector('.panel-footer-usage');
  }

  getLoadMoreButton(): HTMLButtonElement | null {
    return this.element.querySelector('.panel-load-more') as HTMLButtonElement | null;
  }

  /**
   * Sets the footer content.
   */
  setFooterContent(content: string | HTMLElement): void {
    const usage = this.getFooterUsage();
    if (!usage) return;

    if (typeof content === 'string') {
      usage.textContent = content;
    } else {
      clearElement(usage);
      usage.appendChild(content);
    }
  }
}


