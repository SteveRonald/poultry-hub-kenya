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

// Log the API base URL for debugging
if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE_URL);
}

// Helper function to convert localhost URLs to network URLs for images
export const getImageUrl = (imageUrl: string) => {
  if (!imageUrl) return '';
  
  // If it's already a full URL (http/https), convert localhost to current host if needed
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    const currentHost = window.location.hostname;
    const currentProtocol = window.location.protocol;
    // For images, we typically don't need the port (they're served on port 80/443)
    // But if the current location has a port, we might need it
    const currentPort = window.location.port && window.location.port !== '80' && window.location.port !== '443' 
      ? `:${window.location.port}` 
      : '';
    
    // Convert localhost/127.0.0.1 to current host for mobile/network access
    if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
      if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        try {
          // Extract the path from the original URL
          const urlObj = new URL(imageUrl);
          const path = urlObj.pathname;
          
          // Replace the host part, keeping the path
          // Images are served on port 80 (XAMPP default), so don't include port
          const newUrl = `${currentProtocol}//${currentHost}${path}`;
          
          if (import.meta.env.DEV) {
            console.log('getImageUrl - Converting localhost URL:', {
              original: imageUrl,
              converted: newUrl,
              currentHost,
              path
            });
          }
          
          return newUrl;
        } catch (e) {
          // If URL parsing fails, try simple string replacement
          const pathMatch = imageUrl.match(/\/poultry-hub-kenya\/.*$/);
          if (pathMatch) {
            const newUrl = `${currentProtocol}//${currentHost}${pathMatch[0]}`;
            if (import.meta.env.DEV) {
              console.log('getImageUrl - Fallback conversion:', {
                original: imageUrl,
                converted: newUrl
              });
            }
            return newUrl;
          }
        }
      }
    }
    return imageUrl;
  }
  
  // If it's a relative path starting with /, construct full URL
  if (imageUrl.startsWith('/')) {
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    // For images, typically no port needed (port 80/443)
    const port = '';
    
    // Ensure the path includes the project folder if needed
    if (!imageUrl.startsWith('/poultry-hub-kenya/')) {
      // Check if it's an uploads path
      if (imageUrl.startsWith('/uploads/')) {
        return `${protocol}//${host}${port}/poultry-hub-kenya${imageUrl}`;
      }
    }
    
    return `${protocol}//${host}${port}${imageUrl}`;
  }
  
  // If it's just a filename (no path), prepend uploads path
  // This handles cases where just the filename is stored
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = '';
  
  // Check if filename already looks like it might be in uploads/products
  if (imageUrl.includes('/')) {
    // It has a path, construct full URL
    return `${protocol}//${host}${port}/poultry-hub-kenya/${imageUrl}`;
  }
  
  // Just a filename, assume it's in uploads/products
  return `${protocol}//${host}${port}/poultry-hub-kenya/uploads/products/${imageUrl}`;
};



