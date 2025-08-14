// API client utility for handling different environments
const getApiBaseUrl = () => {
  // Use environment variable if set, otherwise default to localhost
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
};

export const apiClient = {
  // Make API calls with the correct base URL
  fetch: async (endpoint: string, options: RequestInit = {}) => {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    
    console.log(`[api-client] Making request to: ${url}`);
    
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  },
  
  // Helper for POST requests
  post: async (endpoint: string, data: any, options: RequestInit = {}) => {
    return apiClient.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    });
  },
  
  // Helper for GET requests
  get: async (endpoint: string, options: RequestInit = {}) => {
    return apiClient.fetch(endpoint, {
      method: 'GET',
      ...options,
    });
  },
};

export default apiClient;
