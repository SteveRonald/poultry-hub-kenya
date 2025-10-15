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
    
    // If accessing from ngrok, use the same host
    if (host.includes('ngrok')) {
      return `https://${host}/poultry-hub-kenya/backend`;
    }
    
    // If accessing from network (e.g., 192.168.x.x), use the same host
    // For XAMPP, we need to include the project folder in the path
    // Also handle the case where we're using the built-in PHP server
    if (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
      // Try XAMPP first, then fallback to built-in server
      return `http://${host}/poultry-hub-kenya/backend`;
    }
    
    // Default fallback
    return `http://${host}/poultry-hub-kenya/backend`;
  }
  
  // Production mode - InfinityFree backend URL
  // Also check if we're on Netlify domain
  if (window.location.hostname === 'poultryhubkenya.netlify.app' || 
      window.location.hostname.includes('netlify.app')) {
    return 'https://poultryhubkenya.great-site.net';
  }
  
  return 'https://poultryhubkenya.great-site.net';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};

// Log the API base URL for debugging
console.log('Environment:', import.meta.env.MODE);
console.log('Is DEV:', import.meta.env.DEV);
console.log('Hostname:', window.location.hostname);
console.log('API Base URL:', API_BASE_URL);

// Helper function to convert localhost URLs to network URLs for images
export const getImageUrl = (imageUrl: string) => {
  if (!imageUrl) return '';
  
  // If it's already a network URL or external URL, return as is
  if (imageUrl.startsWith('http://192.168.') || 
      imageUrl.startsWith('http://10.') || 
      imageUrl.startsWith('http://172.') ||
      imageUrl.startsWith('https://') ||
      imageUrl.includes('ngrok')) {
    return imageUrl;
  }
  
  // If it's a localhost URL, convert to network URL
  if (imageUrl.includes('localhost')) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return imageUrl.replace('localhost', host);
    }
  }
  
  return imageUrl;
};



