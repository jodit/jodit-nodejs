import puppeteer, { Browser } from 'puppeteer';
import { logger } from './logger';

interface BrowserPoolOptions {
  /**
   * Time in milliseconds to keep browser alive after last use
   * @default 30000 (30 seconds)
   */
  idleTimeout?: number;

  /**
   * Puppeteer launch options
   */
  launchOptions?: Parameters<typeof puppeteer.launch>[0];
}

/**
 * Chromium flags used when the caller does not pass its own `launchOptions`.
 *
 * The renderers are fed HTML by the client, so the Chromium sandbox is what
 * keeps a renderer bug from turning into code execution inside the container.
 * It is off by default only because Docker's default seccomp profile blocks
 * the syscalls the sandbox needs, and a container that cannot start Chromium
 * at all is worse than one that renders without it.
 *
 * Set `CHROMIUM_SANDBOX=1` to keep the sandbox, and run the container with a
 * seccomp profile that allows it, for example the one shipped next to the
 * Dockerfile:
 *
 * ```
 * docker run --security-opt seccomp=./docker/chromium-seccomp.json ...
 * ```
 *
 * The image already runs as a non-root user, which the sandbox also requires.
 *
 * `CHROMIUM_BLOCKED_HOSTS` is an optional comma-separated list of host names
 * or addresses that must not resolve inside the renderer, for example
 * `169.254.169.254,metadata.google.internal`. It is empty by default and is
 * not the protection against SSRF: every request the page makes is already
 * checked against {@link checkRemoteResource}, which resolves the host and
 * refuses private, loopback and link-local addresses whatever they are called.
 * This list only helps with what request interception cannot see, such as
 * Chromium's own speculative DNS lookups, and what a host really must never
 * reach is better blocked for the whole container at the network level.
 */
export function defaultChromiumArgs(): string[] {
  const sandbox = process.env.CHROMIUM_SANDBOX === '1';

  const blockedHosts = (process.env.CHROMIUM_BLOCKED_HOSTS ?? '')
    .split(',')
    .map(host => host.trim())
    .filter(host => host.length > 0);

  return [
    ...(sandbox ? [] : ['--no-sandbox', '--disable-setuid-sandbox']),
    '--disable-dev-shm-usage',
    '--disable-gpu',
    ...(blockedHosts.length > 0
      ? [
          `--host-resolver-rules=${blockedHosts
            .map(host => `MAP ${host} ~NOTFOUND`)
            .join(',')}`
        ]
      : [])
  ];
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
    this.idleTimeout = options.idleTimeout ?? 30000; // 30 seconds default
    this.launchOptions = options.launchOptions ?? {
      headless: true,
      args: defaultChromiumArgs()
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
      logger.error(
        `Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
        logger.error(
          `Error closing idle browser: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      });
    }, this.idleTimeout);

    logger.debug(
      `Browser will be closed after ${this.idleTimeout}ms of inactivity`
    );
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
        logger.error(
          `Error closing browser: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
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

// Export singleton instance. It deliberately does NOT pass `launchOptions`:
// the defaults live in the constructor, and a second copy here silently won
// over them (that is how `--no-sandbox` survived being removed once already).
export const browserPool = new BrowserPool({
  idleTimeout: 30000 // 30 seconds
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
