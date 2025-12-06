
import { getStorage } from '../utils/storage.js';
import { parseOpenAPIFromUrl, extractApiDoc } from '../utils/openapi-parser.js';

/**
 * Smart Caching Check
 * Checks if the API doc has changed by comparing hashes.
 * If changed, auto-refreshes the doc.
 */
export async function checkAndRefreshApiDoc(docId: string): Promise<void> {
    try {
        const storage = await getStorage();
        const doc = await storage.getApiDoc(docId);

        if (!doc || !doc.apiHashUrl || !doc.specUrl) {
            return; // Nothing to check
        }

        // 1. Fetch remote hash
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout for preflight

        const response = await fetch(doc.apiHashUrl, {
            signal: controller.signal,
        }).catch(() => null);

        clearTimeout(timeoutId);

        if (!response || !response.ok) {
            // Silently fail on check, proceed with cached data
            return;
        }

        const remoteHash = (await response.text()).trim();

        // 2. Compare with local hash
        if (doc.lastHash === remoteHash) {
            return; // Cache hit, nothing changed
        }

        console.error(`[SmartCache] Hash mismatch for ${docId}. Local: ${doc.lastHash}, Remote: ${remoteHash}. Refreshing...`);

        // 3. Refresh data
        const { spec } = await parseOpenAPIFromUrl(doc.specUrl);
        const updated = extractApiDoc(spec, doc.id, doc.name, doc.specUrl);

        // Persist settings
        updated.baseUrl = doc.baseUrl;
        updated.addedAt = doc.addedAt;
        updated.apiHashUrl = doc.apiHashUrl;
        updated.lastHash = remoteHash; // Update hash

        await storage.updateApiDoc(docId, updated);
        console.error(`[SmartCache] Refreshed ${docId} successfully.`);

    } catch (error) {
        // Log but don't block the main operation
        console.error(`[SmartCache] Error checking/refreshing doc ${docId}:`, error);
    }
}
