/**
 * Utility for managing device-specific identifiers
 * Used to isolate data between different devices accessing the website
 */

const DEVICE_ID_KEY = 'device_id';

/**
 * Generates a UUID v4 string
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Gets the current device ID or generates a new one if none exists
 * @returns {string} The device ID
 * @throws {Error} If localStorage is not available
 */
export function getDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = generateUUID();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Failed to access localStorage:', error);
    // Fallback to session-based ID if localStorage fails
    return generateUUID();
  }
}

/**
 * Clears the stored device ID
 * @throws {Error} If localStorage is not available
 */
export function clearDeviceId(): void {
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
  } catch (error) {
    console.error('Failed to clear device ID:', error);
  }
}
