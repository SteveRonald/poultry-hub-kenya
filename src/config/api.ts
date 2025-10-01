// API Configuration for dynamic host detection
const getApiBaseUrl = () => {
  // Check if we're in development mode
  if (import.meta.env.DEV) {
    // Get the current host from window.location
    const host = window.location.hostname;
    const port = window.location.port;
    
    // If accessing from localhost, use localhost
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost/poultry-hub-kenya/backend';
    }
    
    // If accessing from network (e.g., 192.168.x.x), use the same host
    return `http://${host}${port ? ':' + port : ''}/poultry-hub-kenya/backend`;
  }
  
  // Production mode - you can set your production URL here
  return 'https://yourdomain.com/backend';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};

// Log the API base URL for debugging
console.log('API Base URL:', API_BASE_URL);



