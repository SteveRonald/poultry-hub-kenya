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
  
  // Production mode - you can set your production URL here
   return 'https://PoultryhubKenya.great-site.net/backend';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};

// Log the API base URL for debugging (disabled for security)
// if (import.meta.env.DEV) {
//   console.log('API Base URL:', API_BASE_URL);
// }

// Helper function to convert localhost URLs to network URLs for images
export const getImageUrl = (imageUrl: string) => {
  if (!imageUrl) return '';
  
  // If it's already a full URL (http/https), return as is (after localhost conversion if needed)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Convert localhost to current host if needed
    if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
      const host = window.location.hostname;
      const protocol = window.location.protocol;
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return imageUrl.replace(/https?:\/\/[^\/]+/, `${protocol}//${host}`);
      }
    }
    return imageUrl;
  }
  
  // If it's a relative path starting with /, construct full URL
  if (imageUrl.startsWith('/')) {
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${protocol}//${host}${port}${imageUrl}`;
  }
  
  // If it's just a filename, prepend uploads path
  // This handles cases where just the filename is stored
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${protocol}//${host}${port}/poultry-hub-kenya/uploads/products/${imageUrl}`;
};



