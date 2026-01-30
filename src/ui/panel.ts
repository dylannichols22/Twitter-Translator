/**
 * Side Panel for Twitter Translator
 * Renders as a right-side drawer overlaying Twitter content.
 */

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
  closeBtn.textContent = '×';
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
  panel.appendChild(footer);

  document.body.appendChild(panel);
  panelInstance = panel;

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
      container.innerHTML = '';
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

    container.innerHTML = '';

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

  /**
   * Sets the footer content.
   */
  setFooterContent(content: string | HTMLElement): void {
    const footer = this.getFooter();
    if (!footer) return;

    if (typeof content === 'string') {
      footer.textContent = content;
    } else {
      footer.innerHTML = '';
      footer.appendChild(content);
    }
  }
}
