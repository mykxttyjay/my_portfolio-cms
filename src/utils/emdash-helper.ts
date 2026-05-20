/**
 * Safe wrapper for getEmDashCollection that handles cases where emdash is not available
 */
export async function safeGetEmDashCollection(collectionName: string) {
  try {
    // Dynamically import emdash to avoid errors if it's not configured
    const { getEmDashCollection } = await import('emdash');
    const result = await getEmDashCollection(collectionName);
    return result;
  } catch (e) {
    console.warn(`EmDash collection '${collectionName}' not available, using fallback data:`, e);
    return { entries: [] };
  }
}
