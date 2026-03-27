/**
 * UNIFIED SAVE FUNCTION FOR DISCOVERED STARTUPS
 *
 * Uses lib/startupInsertGate for validation and insert.
 * Adds optional companyFilters (public/late-stage exclusion).
 */

const { insertDiscovered } = require('../lib/startupInsertGate');

/**
 * Save a discovered startup with proper schema validation
 * @param {Object} startup - Startup data object
 * @param {Object} options - Options for saving
 * @returns {Promise<{success: boolean, id?: string, error?: string, skipped?: boolean, filtered?: boolean}>}
 */
async function saveDiscoveredStartup(startup, options = {}) {
  const { checkDuplicates = true, skipCompanyFilter = false } = options;

  // Optional: filter public/late-stage companies
  if (!skipCompanyFilter) {
    try {
      const { shouldFilterCompany } = require('./companyFilters');
      const filterCheck = shouldFilterCompany(startup.name, startup.description, startup.funding_stage);
      if (filterCheck.shouldFilter) {
        return { success: false, error: `Filtered: ${filterCheck.reason}`, filtered: true };
      }
    } catch (e) {
      // companyFilters optional
    }
  }

  const r = await insertDiscovered(startup, { checkDuplicates });

  if (r.ok) {
    return { success: true, id: r.id, skipped: r.skipped || false };
  }
  return { success: false, error: r.error };
}

/**
 * Batch save multiple startups
 * @param {Array} startups - Array of startup objects
 * @param {Object} options - Options for saving
 * @returns {Promise<{saved: number, skipped: number, errors: number}>}
 */
async function saveDiscoveredStartupsBatch(startups, options = {}) {
  const results = {
    saved: 0,
    skipped: 0,
    errors: 0
  };

  for (const startup of startups) {
    const result = await saveDiscoveredStartup(startup, options);
    
    if (result.success) {
      if (result.skipped) {
        results.skipped++;
      } else {
        results.saved++;
      }
    } else {
      results.errors++;
      if (options.verbose) {
        console.error(`Error saving ${startup.name}:`, result.error);
      }
    }
  }

  return results;
}

module.exports = {
  saveDiscoveredStartup,
  saveDiscoveredStartupsBatch
};

