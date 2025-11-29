import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode as base64Decode } from 'base-64';

// API configuration
const API_BASE_URL = 'https://api.thevitachoice.com/api';
// const API_BASE_URL = 'https://309a627b3067.ngrok-free.app/api'

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  isAuthError?: boolean;
}

interface AuthTokens {
  access: string;
  refresh: string;
}

interface PersistedAuthState {
  tokens: AuthTokens;
  accessExpiresAt: number | null;
  refreshExpiresAt: number | null;
}

type AuthFailureReason = 'refresh-expired' | 'auth-error';

interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  date_joined?: string;
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
  ingredients?: FormulaIngredient[];
  items?: FormulaIngredient[];
  owner: number;
  created_at: string;
  updated_at: string;
}

interface FormulaIngredient {
  id: number;
  ingredient: Ingredient;
  dose_value: number | string;
  dose_unit: string;
  notes?: string;
  order?: number;
}

type ComplianceStatus = 'APPROVED' | 'WARNING' | 'STOP' | 'EMPTY';

interface ComplianceSummaryCounts {
  safe: number;
  caution: number;
  risk: number;
}

interface ComplianceSummaryResponse {
  status: ComplianceStatus;
  summary: ComplianceSummaryCounts;
  total_ingredients?: number;
  message?: string;
}

interface ComplianceIssue {
  ingredient_id?: number;
  ingredient_name?: string;
  ingredient: string;
  dose?: string;
  dose_value?: number;
  dose_unit?: string;
  category?: string;
  severity: 'RISK' | 'CAUTION';
  level?: 'RISK' | 'CAUTION';
  safety_info?: string;
  message: string;
  action?: string;
}

interface ComplianceResult {
  status: 'APPROVED' | 'WARNING' | 'STOP' | 'EMPTY';
  status_message: string;
  can_proceed: boolean;
  formula_id: number;
  formula_name: string;
  region: string;
  total_ingredients: number;
  total_weight_mg: number;
  summary: ComplianceSummaryCounts;
  issues: ComplianceIssue[];
  checked_at: string;
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
  private accessTokenExpiresAt: number | null = null;
  private refreshTokenExpiresAt: number | null = null;
  // When true, tokens are persisted to AsyncStorage. Can be toggled by the app (Remember Me).
  private persistTokens: boolean = true;
  private proactiveRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private refreshInFlight: Promise<boolean> | null = null;
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private readonly MAX_RETRIES = 2;
  private readonly REFRESH_SAFETY_WINDOW = 2 * 60 * 1000; // 2 minutes max lead time
  private readonly MIN_REFRESH_SAFETY_WINDOW = 5000; // 5 seconds
  private readonly MIN_REFRESH_DELAY = 5000; // 5 seconds
  private readonly REFRESH_RETRY_DELAYS = [2000, 5000, 10000];
  private authFailureHandler?: (reason?: AuthFailureReason, message?: string) => Promise<void>;

  constructor() {
    this.loadTokens();
  }

  // Set auth failure handler
  setAuthFailureHandler(handler: (reason?: AuthFailureReason, message?: string) => Promise<void>) {
    this.authFailureHandler = handler;
  }

  // Token Management
  private async loadTokens(): Promise<void> {
    try {
      // Only load tokens from storage if the user previously chose "remember me".
      const rememberFlag = await AsyncStorage.getItem('rememberMe');
      if (rememberFlag !== 'true') {
        // Do not load persisted tokens when remember is false
        // In-memory tokens will be set via saveTokens() after login
        return;
      }
      const tokensString = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKENS);
      if (tokensString) {
        try {
          const parsed: PersistedAuthState | AuthTokens = JSON.parse(tokensString);
          if ('tokens' in parsed) {
            this.tokens = parsed.tokens;
            this.accessTokenExpiresAt = parsed.accessExpiresAt ?? null;
            this.refreshTokenExpiresAt = parsed.refreshExpiresAt ?? null;
          } else {
            // Backwards compatibility with old shape that only stored tokens
            this.tokens = parsed;
            this.accessTokenExpiresAt = this.decodeTokenExpiry(parsed.access);
            this.refreshTokenExpiresAt = this.decodeTokenExpiry(parsed.refresh);
          }
          this.scheduleProactiveRefresh();
        } catch (parseError) {
          console.error('Failed to parse stored auth tokens', parseError);
        }
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  }

  private async saveTokens(tokens: AuthTokens): Promise<void> {
    try {
      this.tokens = tokens;
      this.accessTokenExpiresAt = this.decodeTokenExpiry(tokens.access);
      this.refreshTokenExpiresAt = this.decodeTokenExpiry(tokens.refresh);
      if (this.persistTokens) {
        const payload: PersistedAuthState = {
          tokens,
          accessExpiresAt: this.accessTokenExpiresAt,
          refreshExpiresAt: this.refreshTokenExpiresAt,
        };
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKENS, JSON.stringify(payload));
      } else {
        // If not persisting tokens, ensure any previously-stored tokens are removed
        // Note: We keep the user data in storage even when remember is false,
        // as it's needed for the current session
        try {
          await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKENS);
        } catch (e) {
          // ignore
        }
      }
      this.scheduleProactiveRefresh();
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  // Control whether tokens should be persisted to AsyncStorage (used for Remember Me)
  setPersistTokens(shouldPersist: boolean) {
    this.persistTokens = shouldPersist;
  }

  private async clearTokens(): Promise<void> {
    try {
      this.tokens = null;
      this.accessTokenExpiresAt = null;
      this.refreshTokenExpiresAt = null;
      if (this.proactiveRefreshTimeout) {
        clearTimeout(this.proactiveRefreshTimeout);
        this.proactiveRefreshTimeout = null;
      }
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKENS);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  private async getAuthHeaders(includeContentType: boolean = true): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

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
    // Ensure tokens are loaded before making request
    if (!this.tokens) {
      await this.loadTokens();
    }

    try {
      const url = `${this.baseURL}${endpoint}`;
      const includeContentType = options.method !== 'GET';
      const headers = await this.getAuthHeaders(includeContentType);

      const response = await this.fetchWithTimeout(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (response.status === 401 && this.tokens?.refresh) {
        // Try to refresh token
        const refreshed = await this.refreshToken('request');
        if (refreshed) {
          // Retry the original request
          const newHeaders = await this.getAuthHeaders(includeContentType);
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

        // If refresh failed, handle auth failure
        if (this.authFailureHandler) {
          await this.authFailureHandler('auth-error', 'Authentication failed. Please login again.');
        }
        return { error: 'Authentication failed. Please login again.', isAuthError: true };
      }

      if (!response.ok) {
        // Try to parse structured error info from the server
        const errorData = await response.json().catch(() => ({} as any));

        const extractErrorMessage = (d: unknown): string | undefined => {
          try {
            const anyd = d as any;
            if (!anyd) return undefined;
            if (typeof anyd === 'string') return anyd;
            if (anyd.detail) return anyd.detail;
            if (anyd.message) return anyd.message;
            if (anyd.error) return anyd.error;
            if (Array.isArray(anyd.non_field_errors)) return anyd.non_field_errors[0];
            const vals = Object.values(anyd);
            if (vals.length > 0) {
              const first = vals[0];
              if (Array.isArray(first)) return first[0];
              return String(first);
            }
          } catch (e) {
            // ignore
          }
          return undefined;
        };

        const serverMsg = extractErrorMessage(errorData);

        const method = (options && (options.method as string)) || 'GET';
        const statusText = (response as any).statusText || '';
        const baseMsg = `${method.toUpperCase()} ${endpoint} failed (${response.status}${statusText ? ' ' + statusText : ''})`;

        return {
          error: serverMsg ? `${baseMsg}: ${serverMsg}` : baseMsg,
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

      // Include endpoint/method context for network errors as well
      try {
        const method = (options && (options.method as string)) || 'GET';
        return { error: `${method.toUpperCase()} ${endpoint} failed: ${error.message || 'Network error. Please check your connection.'}` };
      } catch (e) {
        return { error: error.message || 'Network error. Please check your connection.' };
      }
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

  private decodeTokenExpiry(token: string): number | null {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64Payload.length % 4)) % 4);
      const decoded = base64Decode(base64Payload + padding);
      const payload = JSON.parse(decoded);
      if (payload && typeof payload.exp === 'number') {
        return payload.exp * 1000; // convert seconds to ms
      }
    } catch (error) {
      console.warn('Failed to decode JWT expiry', error);
    }
    return null;
  }

  private clearProactiveRefreshTimer() {
    if (this.proactiveRefreshTimeout) {
      clearTimeout(this.proactiveRefreshTimeout);
      this.proactiveRefreshTimeout = null;
    }
  }

  private scheduleProactiveRefresh() {
    this.clearProactiveRefreshTimer();
    if (!this.accessTokenExpiresAt || !this.tokens?.refresh) {
      return;
    }

    const now = Date.now();
    const msUntilExpiry = this.accessTokenExpiresAt - now;
    if (msUntilExpiry <= 0) {
      // Already expired or invalid — attempt immediate refresh
      this.refreshToken('proactive').catch(error => {
        console.error('Proactive refresh failed', error);
      });
      return;
    }

    const dynamicSafetyWindow = Math.min(
      this.REFRESH_SAFETY_WINDOW,
      Math.max(Math.floor(msUntilExpiry * 0.25), this.MIN_REFRESH_SAFETY_WINDOW)
    );
    const delayMs = Math.max(
      this.MIN_REFRESH_DELAY,
      msUntilExpiry - dynamicSafetyWindow
    );

    this.proactiveRefreshTimeout = setTimeout(() => {
      this.refreshToken('proactive').catch(error => {
        console.error('Scheduled proactive refresh failed', error);
      });
    }, delayMs);
  }

  async ensureFreshAccessToken(minValidityMs: number = this.REFRESH_SAFETY_WINDOW): Promise<boolean> {
    if (!this.tokens?.access) {
      return false;
    }

    if (!this.accessTokenExpiresAt) {
      return true;
    }

    const remaining = this.accessTokenExpiresAt - Date.now();
    const dynamicValidityThreshold = Math.min(
      minValidityMs,
      Math.max(Math.floor(remaining * 0.25), this.MIN_REFRESH_SAFETY_WINDOW)
    );

    if (remaining > dynamicValidityThreshold) {
      return true;
    }

    const refreshed = await this.refreshToken('proactive');
    return refreshed;
  }

  shouldPersistAuthTokens(): boolean {
    return this.persistTokens;
  }

  getAccessTokenExpiry(): number | null {
    return this.accessTokenExpiresAt;
  }

  getRefreshTokenExpiry(): number | null {
    return this.refreshTokenExpiresAt;
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
      // Always save user data for the current session, regardless of remember me choice
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
      // Always save user data for the current session, regardless of remember me choice
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
    }

    return response;
  }

  // Check if an email is available for registration. Backend may support
  // /auth/check-email/?email=... returning { available: boolean }
  async checkEmailAvailability(email: string): Promise<ApiResponse<{ available: boolean }>> {
    if (!email) return { error: 'No email provided' };

    const params = new URLSearchParams({ email });
    try {
      const response = await this.request<{ available: boolean }>(`/auth/check-email/?${params.toString()}`);
      return response;
    } catch (error: any) {
      // If the endpoint doesn't exist or fails, return an error message
      console.error('checkEmailAvailability error:', error);
      return { error: 'Could not verify email availability' };
    }
  }

  async refreshToken(trigger: 'request' | 'proactive' | 'resume' = 'request'): Promise<boolean> {
    if (!this.tokens?.refresh) {
      return false;
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const performRefresh = async (): Promise<boolean> => {
      for (let attempt = 0; attempt <= this.REFRESH_RETRY_DELAYS.length; attempt++) {
        try {
          const response = await this.fetchWithTimeout(`${this.baseURL}/auth/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: this.tokens?.refresh }),
          });

          if (response.ok) {
            const data = await response.json();
            const newTokens: AuthTokens = {
              access: data.access,
              refresh: data.refresh ?? this.tokens!.refresh,
            };
            await this.saveTokens(newTokens);
            return true;
          }

          if (response.status === 401 || response.status === 403) {
            console.warn('Refresh token expired or invalid');
            await this.clearTokens();
            if (this.authFailureHandler) {
              await this.authFailureHandler('refresh-expired', 'Session expired. Please sign in again.');
            }
            return false;
          }

          const errorData = await response.json().catch(() => undefined);
          console.error(`Refresh token failed (status ${response.status})`, errorData);
        } catch (error) {
          console.error('Refresh token request error:', error);
        }

        if (attempt < this.REFRESH_RETRY_DELAYS.length) {
          const delayMs = this.REFRESH_RETRY_DELAYS[attempt];
          await this.delay(delayMs);
        }
      }

      console.error('Refresh token attempts exhausted');
      return false;
    };

    this.refreshInFlight = performRefresh().finally(() => {
      this.refreshInFlight = null;
    });

    const success = await this.refreshInFlight;
    return success;
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

  // Get user profile from API
  async getUserProfile(): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/me/');
  }

  async updateProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    const response = await this.request<User>('/auth/me/', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });

    // Update local storage if successful
    if (response.data && this.persistTokens) {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data));
    }

    return response;
  }

  async changePassword(data: {
    old_password: string;
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
    category?: string | string[];
    source?: string | string[];
    safety?: string;
    safety_level?: string;
    ordering?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse<{ count: number; results: Ingredient[] }>> {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;

        if (Array.isArray(value)) {
          value
            .filter((item) => item !== undefined && item !== null && String(item).length > 0)
            .forEach((item) => searchParams.append(key, item.toString()));
          return;
        }

        const stringValue = value.toString();
        if (stringValue.length > 0) {
          searchParams.append(key, stringValue);
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
    const response = await this.request<{ count: number; results: Formula[] }>('/formulas/');
    if (response.data) {
      return { data: response.data.results };
    }
    return { error: response.error };
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
    return this.request<FormulaIngredient>(`/formulas/${formulaId}/add_ingredient/`, {
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
    return this.request<FormulaIngredient>(`/formulas/${formulaId}/update_ingredient/${ingredientId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async removeIngredientFromFormula(
    formulaId: number,
    ingredientId: number
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(
      `/formulas/${formulaId}/remove_ingredient/${ingredientId}/`,
      {
        method: 'DELETE',
      }
    );
  }

  // Compliance Methods
  async getComplianceSummary(formulaId: number): Promise<ApiResponse<ComplianceSummaryResponse>> {
    return this.request<ComplianceSummaryResponse>(`/formulas/${formulaId}/compliance_summary/`, {
      method: 'GET',
    });
  }

  async checkCompliance(
    formulaId: number,
    options: { region?: string } = {}
  ): Promise<ApiResponse<ComplianceResult>> {
    const { region } = options;
    const requestInit: RequestInit = {
      method: 'POST',
    };

    if (region) {
      requestInit.body = JSON.stringify({ region });
    }

    return this.request<ComplianceResult>(`/formulas/${formulaId}/check_compliance/`, requestInit);
  }

  // Export Methods
  async exportSupplementLabel(formulaId: number): Promise<ApiResponse<{ download_url: string }>> {
    return this.request<{ download_url: string }>(`/formulas/${formulaId}/export_label/`);
  }

  async exportFormulaSummary(formulaId: number): Promise<ApiResponse<{ download_url: string }>> {
    return this.request<{ download_url: string }>(`/formulas/${formulaId}/export_summary/`);
  }

  async exportFormulaCSV(formulaId: number): Promise<ApiResponse<{ download_url: string }>> {
    return this.request<{ download_url: string }>(`/formulas/${formulaId}/export_csv/`);
  }

  async exportAllFormulasCSV(): Promise<ApiResponse<{ download_url: string }>> {
    return this.request<{ download_url: string }>(`/formulas/export_all_csv/`);
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.tokens?.access) {
      await this.loadTokens();
    }
    return this.tokens?.access ?? null;
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
  AuthTokens, ComplianceIssue, ComplianceResult, ComplianceStatus, ComplianceSummaryCounts, ComplianceSummaryResponse, Formula,
  FormulaIngredient, Ingredient, User
};

export { API_BASE_URL };

