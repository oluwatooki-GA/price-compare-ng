/**
 * Scraper registry for managing platform adapters
 * Requirement 8.2: Platform extensibility - automatic inclusion of new platforms
 */

import { ScraperAdapter } from './base';

/**
 * Registry class that manages all registered platform scrapers
 * Allows dynamic registration of new platform adapters without modifying core search logic
 */
export class ScraperRegistry {
  private scrapers: Map<string, ScraperAdapter> = new Map();

  /**
   * Register a new platform scraper
   * @param scraper - Platform adapter implementing ScraperAdapter interface
   * @throws Error if a scraper with the same platform name is already registered
   */
  registerScraper(scraper: ScraperAdapter): void {
    const platformName = scraper.platformName;
    
    if (this.scrapers.has(platformName)) {
      throw new Error(`Scraper for platform "${platformName}" is already registered`);
    }
    
    this.scrapers.set(platformName, scraper);
  }

  /**
   * Get all registered scrapers
   * @returns Array of all registered platform adapters
   */
  getAllScrapers(): ScraperAdapter[] {
    return Array.from(this.scrapers.values());
  }

  /**
   * Get a specific scraper by platform name
   * @param platformName - Name of the platform
   * @returns The scraper adapter or undefined if not found
   */
  getScraperByPlatform(platformName: string): ScraperAdapter | undefined {
    return this.scrapers.get(platformName);
  }

  /**
   * Check if a platform is registered
   * @param platformName - Name of the platform
   * @returns True if the platform is registered
   */
  hasPlatform(platformName: string): boolean {
    return this.scrapers.has(platformName);
  }

  /**
   * Get the number of registered scrapers
   * @returns Count of registered platforms
   */
  getScraperCount(): number {
    return this.scrapers.size;
  }

  /**
   * Clear all registered scrapers (useful for testing)
   */
  clear(): void {
    this.scrapers.clear();
  }
}

// Export a singleton instance for use across the application
export const scraperRegistry = new ScraperRegistry();
