import AsyncStorage from '@react-native-async-storage/async-storage';

// API configuration
const API_BASE_URL = 'https://vita-choice-backend.onrender.com/api';

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

interface AuthTokens {
  access: string;
  refresh: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface Ingredient {
  id: number;
  name: string;
  category: string;
  source: string;
  safety: string;
  evidence?: string;
  created_at: string;
  updated_at: string;
}

interface Formula {
  id: number;
  name: string;
  description?: string;
  region: 'US' | 'EU' | 'CA' | 'AU';
  ingredients: FormulaIngredient[];
  owner: number;
  created_at: string;
  updated_at: string;
}

interface FormulaIngredient {
  id: number;
  ingredient: Ingredient;
  dose_value: number;
  dose_unit: string;
  notes?: string;
}

interface ComplianceResult {
  formula_id: number;
  region: string;
  status: 'APPROVED' | 'WARNING' | 'STOP';
  status_message: string;
  issues: ComplianceIssue[];
  checked_at: string;
}

interface ComplianceIssue {
  ingredient_name: string;
  dose_value: number;
  dose_unit: string;
  severity: 'RISK' | 'CAUTION';
  message: string;
  action: string;
}

// Storage keys
const STORAGE_KEYS = {
  AUTH_TOKENS: 'auth_tokens',
  USER: 'user',
  CACHED_CATEGORIES: 'cached_categories',
  CACHED_SOURCES: 'cached_sources',
};

class ApiService {
  private baseURL = API_BASE_URL;
  private tokens: AuthTokens | null = null;
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private readonly MAX_RETRIES = 2;

  constructor() {
    this.loadTokens();
  }

  // Token Management
  private async loadTokens(): Promise<void> {
    try {
      const tokensString = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKENS);
      if (tokensString) {
        this.tokens = JSON.parse(tokensString);
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  }

  private async saveTokens(tokens: AuthTokens): Promise<void> {
    try {
      this.tokens = tokens;
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKENS, JSON.stringify(tokens));
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  private async clearTokens(): Promise<void> {
    try {
      this.tokens = null;
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKENS);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.tokens?.access) {
      headers.Authorization = `Bearer ${this.tokens.access}`;
    }

    return headers;
  }

  // Create fetch with timeout
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  // HTTP Request Helper with retry logic
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const headers = await this.getAuthHeaders();
      
      const response = await this.fetchWithTimeout(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (response.status === 401 && this.tokens?.refresh) {
        // Try to refresh token
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the original request
          const newHeaders = await this.getAuthHeaders();
          const retryResponse = await this.fetchWithTimeout(url, {
            ...options,
            headers: {
              ...newHeaders,
              ...options.headers,
            },
          });
          
          if (retryResponse.ok) {
            const data = await retryResponse.json();
            return { data };
          }
        }
        
        // If refresh failed, clear tokens and return error
        await this.clearTokens();
        return { error: 'Session expired. Please login again.' };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          error: errorData.detail || errorData.message || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return { data };
    } catch (error: any) {
      console.error('API Request Error:', error);
      
      // Retry logic for network errors (not for authentication or client errors)
      if (retryCount < this.MAX_RETRIES && this.isRetryableError(error)) {
        console.log(`Retrying request (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.request(endpoint, options, retryCount + 1);
      }
      
      return { error: error.message || 'Network error. Please check your connection.' };
    }
  }

  // Helper to determine if error is retryable
  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and certain HTTP status codes
    const retryableMessages = [
      'Network request failed',
      'Request timeout',
      'Failed to fetch',
      'ERR_NETWORK',
      'ERR_INTERNET_DISCONNECTED'
    ];
    
    return retryableMessages.some(msg => 
      error.message?.includes(msg) || error.toString().includes(msg)
    );
  }

  // Helper for delay
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Authentication Methods
  async register(userData: {
    email: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
  }): Promise<ApiResponse<{ tokens: AuthTokens; user: User }>> {
    const response = await this.request<{ tokens: AuthTokens; user: User }>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.data) {
      await this.saveTokens(response.data.tokens);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
    }

    return response;
  }

  async login(credentials: {
    email: string;
    password: string;
  }): Promise<ApiResponse<{ tokens: AuthTokens; user: User }>> {
    const response = await this.request<{ tokens: AuthTokens; user: User }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.data) {
      await this.saveTokens(response.data.tokens);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
    }

    return response;
  }

  async refreshToken(): Promise<boolean> {
    if (!this.tokens?.refresh) return false;

    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.tokens.refresh }),
      });

      if (response.ok) {
        const data = await response.json();
        await this.saveTokens({ access: data.access, refresh: this.tokens.refresh });
        return true;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
    }

    return false;
  }

  async logout(): Promise<void> {
    await this.clearTokens();
  }

  // User Methods
  async getCurrentUser(): Promise<User | null> {
    try {
      const userString = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userString ? JSON.parse(userString) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async updateProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/user/', {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  }

  async changePassword(data: {
    current_password: string;
    new_password: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Ingredient Methods
  async getIngredients(params?: {
    search?: string;
    category?: string;
    source?: string;
    safety?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse<{ count: number; results: Ingredient[] }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const query = searchParams.toString();
    const endpoint = query ? `/ingredients/?${query}` : '/ingredients/';
    
    return this.request<{ count: number; results: Ingredient[] }>(endpoint);
  }

  async getIngredient(id: number): Promise<ApiResponse<Ingredient>> {
    return this.request<Ingredient>(`/ingredients/${id}/`);
  }

  async getIngredientCategories(): Promise<ApiResponse<string[]>> {
    // Try to get from cache first
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_CATEGORIES);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000; // 24 hours
        
        if (!isExpired) {
          return { data };
        }
      }
    } catch (error) {
      console.error('Error reading cached categories:', error);
    }

    const response = await this.request<string[]>('/ingredients/categories/');
    
    if (response.data) {
      // Cache the result
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.CACHED_CATEGORIES,
          JSON.stringify({ data: response.data, timestamp: Date.now() })
        );
      } catch (error) {
        console.error('Error caching categories:', error);
      }
    }

    return response;
  }

  async getIngredientSources(): Promise<ApiResponse<string[]>> {
    // Try to get from cache first
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_SOURCES);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000; // 24 hours
        
        if (!isExpired) {
          return { data };
        }
      }
    } catch (error) {
      console.error('Error reading cached sources:', error);
    }

    const response = await this.request<string[]>('/ingredients/sources/');
    
    if (response.data) {
      // Cache the result
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.CACHED_SOURCES,
          JSON.stringify({ data: response.data, timestamp: Date.now() })
        );
      } catch (error) {
        console.error('Error caching sources:', error);
      }
    }

    return response;
  }

  // Formula Methods
  async getFormulas(): Promise<ApiResponse<Formula[]>> {
    return this.request<Formula[]>('/formulas/');
  }

  async getFormula(id: number): Promise<ApiResponse<Formula>> {
    return this.request<Formula>(`/formulas/${id}/`);
  }

  async createFormula(formulaData: {
    name: string;
    description?: string;
    region: string;
  }): Promise<ApiResponse<Formula>> {
    return this.request<Formula>('/formulas/', {
      method: 'POST',
      body: JSON.stringify(formulaData),
    });
  }

  async updateFormula(id: number, formulaData: Partial<Formula>): Promise<ApiResponse<Formula>> {
    return this.request<Formula>(`/formulas/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(formulaData),
    });
  }

  async deleteFormula(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/formulas/${id}/`, {
      method: 'DELETE',
    });
  }

  async duplicateFormula(id: number): Promise<ApiResponse<Formula>> {
    return this.request<Formula>(`/formulas/${id}/duplicate/`, {
      method: 'POST',
    });
  }

  // Formula Ingredient Methods
  async addIngredientToFormula(formulaId: number, ingredientData: {
    ingredient_id: number;
    dose_value: number;
    dose_unit: string;
    notes?: string;
  }): Promise<ApiResponse<FormulaIngredient>> {
    return this.request<FormulaIngredient>(`/formulas/${formulaId}/ingredients/`, {
      method: 'POST',
      body: JSON.stringify(ingredientData),
    });
  }

  async updateFormulaIngredient(
    formulaId: number,
    ingredientId: number,
    data: {
      dose_value?: number;
      dose_unit?: string;
      notes?: string;
    }
  ): Promise<ApiResponse<FormulaIngredient>> {
    return this.request<FormulaIngredient>(`/formulas/${formulaId}/ingredients/${ingredientId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async removeIngredientFromFormula(
    formulaId: number,
    ingredientId: number
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/formulas/${formulaId}/ingredients/${ingredientId}/`, {
      method: 'DELETE',
    });
  }

  // Compliance Methods
  async checkCompliance(formulaId: number, region: string): Promise<ApiResponse<ComplianceResult>> {
    return this.request<ComplianceResult>(`/formulas/${formulaId}/check-compliance/`, {
      method: 'POST',
      body: JSON.stringify({ region }),
    });
  }

  // Export Methods
  async exportSupplementLabel(formulaId: number): Promise<ApiResponse<{ download_url: string }>> {
    return this.request<{ download_url: string }>(`/formulas/${formulaId}/export/label/`);
  }

  async exportFormulaSummary(formulaId: number): Promise<ApiResponse<{ download_url: string }>> {
    return this.request<{ download_url: string }>(`/formulas/${formulaId}/export/summary/`);
  }

  async exportFormulaCSV(formulaId: number): Promise<ApiResponse<{ download_url: string }>> {
    return this.request<{ download_url: string }>(`/formulas/${formulaId}/export/csv/`);
  }

  async exportAllFormulasCSV(): Promise<ApiResponse<{ download_url: string }>> {
    return this.request<{ download_url: string }>('/formulas/export/csv/');
  }

  // Utility Methods
  isAuthenticated(): boolean {
    return !!this.tokens?.access;
  }

  async saveDraft(formulaId: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(`formula_draft_${formulaId}`, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }

  async loadDraft(formulaId: string): Promise<any | null> {
    try {
      const draft = await AsyncStorage.getItem(`formula_draft_${formulaId}`);
      return draft ? JSON.parse(draft) : null;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }

  async clearDraft(formulaId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`formula_draft_${formulaId}`);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export types
export type {
  ApiResponse,
  AuthTokens, ComplianceIssue, ComplianceResult, Formula,
  FormulaIngredient, Ingredient, User
};

    export { API_BASE_URL };

