/**
 * Secure Logger Utility
 * Prevents sensitive information from being logged in production
 */

// Set this to false to completely disable all logging
const ENABLE_LOGGING = false; // Set to true only for debugging

const isDevelopment = import.meta.env.DEV;

export const logger = {
  // Safe logging - only when explicitly enabled
  log: (...args: any[]) => {
    if (ENABLE_LOGGING && isDevelopment) {
      console.log(...args);
    }
  },

  // Error logging - only when explicitly enabled
  error: (...args: any[]) => {
    if (ENABLE_LOGGING && isDevelopment) {
      console.error(...args);
    }
  },

  // Warning logging - only when explicitly enabled
  warn: (...args: any[]) => {
    if (ENABLE_LOGGING && isDevelopment) {
      console.warn(...args);
    }
  },

  // Info logging - only when explicitly enabled
  info: (...args: any[]) => {
    if (ENABLE_LOGGING && isDevelopment) {
      console.info(...args);
    }
  },

  // Debug logging - only when explicitly enabled
  debug: (...args: any[]) => {
    if (ENABLE_LOGGING && isDevelopment) {
      console.debug(...args);
    }
  }
};

// Override console methods globally when logging is disabled
if (!ENABLE_LOGGING) {
  const noop = () => {};
  console.log = noop;
  console.error = noop;
  console.warn = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
  console.table = noop;
  console.group = noop;
  console.groupEnd = noop;
  console.groupCollapsed = noop;
  console.time = noop;
  console.timeEnd = noop;
  console.timeLog = noop;
  console.count = noop;
  console.countReset = noop;
  console.clear = noop;
  console.assert = noop;
  console.dir = noop;
  console.dirxml = noop;
  console.profile = noop;
  console.profileEnd = noop;
}