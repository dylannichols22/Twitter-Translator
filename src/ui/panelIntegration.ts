/**
 * Panel Integration
 * Ties together the panel controller, URL watcher, and scraper for a complete
 * side panel experience on Twitter pages.
 */

import { PanelController } from './panelController';
import { UrlWatcher, isTwitterThreadUrl } from './urlWatcher';
import { MESSAGE_TYPES } from '../messages';

export class PanelIntegration {
  private controller: PanelController;
  private urlWatcher: UrlWatcher;
  private messageHandler: ((message: unknown) => void) | null = null;

  constructor() {
    this.controller = new PanelController();
    this.urlWatcher = new UrlWatcher((newUrl) => {
      this.handleUrlChange(newUrl);
    });

    this.setupMessageListener();
    this.urlWatcher.start();
  }

  /**
   * Sets up the message listener for panel toggle commands.
   */
  private setupMessageListener(): void {
    this.messageHandler = (message: unknown) => {
      const msg = message as { type?: string };
      if (msg.type === 'TOGGLE_PANEL') {
        this.toggle();
      }
    };

    if (typeof browser !== 'undefined' && browser.runtime?.onMessage) {
      browser.runtime.onMessage.addListener(this.messageHandler);
    }
  }

  /**
   * Handles URL changes detected by the URL watcher.
   */
  private handleUrlChange(newUrl: string): void {
    if (!this.controller.isOpen()) {
      return;
    }

    if (isTwitterThreadUrl(newUrl)) {
      // Clear and re-translate
      this.controller.clearTweets();
      void this.scrapeAndTranslate();
    } else {
      // Show empty state for non-thread pages
      this.controller.showEmptyState();
    }
  }

  /**
   * Toggles the panel open/closed.
   */
  toggle(): void {
    this.controller.toggle();

    if (this.controller.isOpen()) {
      // Check if we're on a thread page
      if (isTwitterThreadUrl(window.location.href)) {
        void this.scrapeAndTranslate();
      } else {
        this.controller.showEmptyState();
      }
    }
  }

  /**
   * Opens the panel.
   */
  open(): void {
    if (!this.controller.isOpen()) {
      this.toggle();
    }
  }

  /**
   * Closes the panel.
   */
  close(): void {
    if (this.controller.isOpen()) {
      this.toggle();
    }
  }

  /**
   * Returns whether the panel is open.
   */
  isOpen(): boolean {
    return this.controller.isOpen();
  }

  /**
   * Scrapes the current page and translates content.
   */
  private async scrapeAndTranslate(): Promise<void> {
    this.controller.showLoading(true);

    try {
      // Get settings
      const settings = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_SETTINGS,
      });

      if (!settings?.apiKey) {
        this.controller.showError('Please set your API key in the extension settings');
        return;
      }

      // Scrape the current page
      // This would normally call the scraper, but for now we'll just show loading
      // The actual scraping is done via message passing to the content script
      this.controller.showLoading(false);
    } catch (error) {
      this.controller.showLoading(false);
      this.controller.showError(error instanceof Error ? error.message : 'Translation failed');
    }
  }

  /**
   * Destroys the integration and cleans up.
   */
  destroy(): void {
    this.urlWatcher.stop();
    this.controller.destroy();

    if (this.messageHandler && typeof browser !== 'undefined' && browser.runtime?.onMessage) {
      browser.runtime.onMessage.removeListener(this.messageHandler as never);
    }
  }
}
