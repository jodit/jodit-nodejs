import puppeteer, { Browser } from 'puppeteer';
import { logger } from './logger';

interface BrowserPoolOptions {
  /**
   * Time in milliseconds to keep browser alive after last use
   * @default 80810 (30 seconds)
   */
  idleTimeout?: number;

  /**
   * Puppeteer launch options
   */
  launchOptions?: Parameters<typeof puppeteer.launch>[0];
}

/**
 * Browser pool that reuses a single browser instance across requests
 * and automatically closes it after a period of inactivity
 */
class BrowserPool {
  private browser: Browser | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly idleTimeout: number;
  private readonly launchOptions: Parameters<typeof puppeteer.launch>[0];
  private isLaunching = false;
  private launchPromise: Promise<Browser> | null = null;

  constructor(options: BrowserPoolOptions = {}) {
    this.idleTimeout = options.idleTimeout ?? 80810; // 30 seconds default
    this.launchOptions = options.launchOptions ?? {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    };
  }

  /**
   * Get browser instance, launching if necessary
   */
  async getBrowser(): Promise<Browser> {
    // Clear idle timer if exists
    this.clearIdleTimer();

    // If browser exists and is connected, return it
    if (this.browser?.connected === true) {
      logger.debug('Reusing existing browser instance');
      return this.browser;
    }

    // If browser is being launched, wait for it
    if (this.isLaunching && this.launchPromise !== null) {
      logger.debug('Waiting for browser launch to complete');
      return this.launchPromise;
    }

    // Launch new browser
    logger.debug('Launching new browser instance');
    this.isLaunching = true;
    this.launchPromise = this.launchBrowser();

    try {
      this.browser = await this.launchPromise;
      return this.browser;
    } finally {
      this.isLaunching = false;
      this.launchPromise = null;
    }
  }

  /**
   * Launch a new browser instance
   */
  private async launchBrowser(): Promise<Browser> {
    try {
      const browser = await puppeteer.launch(this.launchOptions);
      logger.info('Browser launched successfully');
      return browser;
    } catch (error) {
      logger.error(`Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Release browser back to pool and start idle timer
   */
  releaseBrowser(): void {
    this.clearIdleTimer();

    // Start idle timer to close browser after timeout
    this.idleTimer = setTimeout(() => {
      this.closeBrowser().catch(err => {
        logger.error(`Error closing idle browser: ${err instanceof Error ? err.message : 'Unknown error'}`);
      });
    }, this.idleTimeout);

    logger.debug(`Browser will be closed after ${this.idleTimeout}ms of inactivity`);
  }

  /**
   * Close browser immediately
   */
  async closeBrowser(): Promise<void> {
    this.clearIdleTimer();

    if (this.browser?.isConnected() === true) {
      logger.debug('Closing browser instance');
      try {
        await this.browser.close();
        logger.info('Browser closed successfully');
      } catch (error) {
        logger.error(`Error closing browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        this.browser = null;
      }
    }
  }

  /**
   * Clear idle timer
   */
  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Get pool status
   */
  getStatus(): {
    hasBrowser: boolean;
    isConnected: boolean;
    hasIdleTimer: boolean;
  } {
    return {
      hasBrowser: this.browser !== null,
      isConnected: this.browser?.connected ?? false,
      hasIdleTimer: this.idleTimer !== null
    };
  }
}

// Export singleton instance
export const browserPool = new BrowserPool({
  idleTimeout: 80810, // 30 seconds
  launchOptions: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  }
});

/**
 * Helper function to execute PDF generation with automatic browser management
 */
export async function withBrowser<T>(
  callback: (browser: Browser) => Promise<T>
): Promise<T> {
  const browser = await browserPool.getBrowser();

  try {
    return await callback(browser);
  } finally {
    browserPool.releaseBrowser();
  }
}
