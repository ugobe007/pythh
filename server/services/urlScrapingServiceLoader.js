'use strict';

// CommonJS routers cannot synchronously require the TypeScript ESM service
// without blocking module initialization. Keep one shared dynamic import and
// preserve the exact scraper exports at the call boundary.
let servicePromise;

function loadUrlScrapingService() {
  if (!servicePromise) {
    servicePromise = import('./urlScrapingService.ts').catch((error) => {
      servicePromise = undefined;
      throw error;
    });
  }
  return servicePromise;
}

async function scrapeAndScoreStartup(...args) {
  const service = await loadUrlScrapingService();
  return service.scrapeAndScoreStartup(...args);
}

async function updateStartupWithScrapedData(...args) {
  const service = await loadUrlScrapingService();
  return service.updateStartupWithScrapedData(...args);
}

module.exports = {
  loadUrlScrapingService,
  scrapeAndScoreStartup,
  updateStartupWithScrapedData,
};
