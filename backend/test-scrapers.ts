/**
 * Quick test script to verify scrapers are working
 */

import { JumiaScraper } from './src/scrapers/jumia';
import { JijiScraper } from './src/scrapers/jiji';
import { TemuScraper } from './src/scrapers/temu';

async function testScrapers() {
  console.log('Testing scrapers...\n');

  const jumiaScraper = new JumiaScraper();
  const jijiScraper = new JijiScraper();
  const temuScraper = new TemuScraper();

  // Test Jumia
  console.log('=== Testing Jumia ===');
  try {
    const jumiaResults = await jumiaScraper.searchProducts('PlayStation 4', 3);
    console.log(`Jumia found ${jumiaResults.length} products:`);
    jumiaResults.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - ₦${product.price}`);
    });
  } catch (error) {
    console.error('Jumia failed:', error);
  }

  console.log('\n=== Testing Jiji ===');
  try {
    const jijiResults = await jijiScraper.searchProducts('PlayStation 4', 3);
    console.log(`Jiji found ${jijiResults.length} products:`);
    jijiResults.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - ₦${product.price}`);
    });
  } catch (error) {
    console.error('Jiji failed:', error);
  }

  console.log('\n=== Testing Temu ===');
  try {
    const temuResults = await temuScraper.searchProducts('PlayStation 4', 3);
    console.log(`Temu found ${temuResults.length} products:`);
    temuResults.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - ₦${product.price}`);
    });
  } catch (error) {
    console.error('Temu failed:', error);
  }
}

testScrapers().catch(console.error);
