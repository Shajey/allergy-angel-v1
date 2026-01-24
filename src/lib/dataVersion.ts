/**
 * Data version management for the POC.
 * When mock data changes (e.g., names), increment the version to force a reseed.
 */

const DATA_VERSION_KEY = "vns-data-version";
const CURRENT_VERSION = 4; // Increment this when mock data changes (v4: CareOS identity refinements)

/**
 * Storage keys that should be cleared when data version changes.
 */
const STORAGE_KEYS_TO_CLEAR = [
  "vns-session",
  "vns-messages",
  "vns-notifications",
  "vns-clinical-documents",
  "vns-view-mode",
];

/**
 * Check if stored data version matches current version.
 * If not, clear all mock data to force a reseed with new data.
 */
export function checkAndMigrateDataVersion(): void {
  try {
    const storedVersion = localStorage.getItem(DATA_VERSION_KEY);
    const version = storedVersion ? parseInt(storedVersion, 10) : 0;

    if (version < CURRENT_VERSION) {
      console.log(`[CareOS] Data version changed (${version} → ${CURRENT_VERSION}). Reseeding mock data...`);
      
      // Clear all mock data storage keys
      STORAGE_KEYS_TO_CLEAR.forEach((key) => {
        localStorage.removeItem(key);
      });

      // Clear task and visit data (which use patient-specific keys)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("vns.tasks.") || key.startsWith("vns.visits.") || key.startsWith("vns.timeline."))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Save new version
      localStorage.setItem(DATA_VERSION_KEY, CURRENT_VERSION.toString());
    }
  } catch (error) {
    console.error("Error checking data version:", error);
  }
}
