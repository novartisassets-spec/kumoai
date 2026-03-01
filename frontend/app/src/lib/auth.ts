import { jwtDecode } from 'jwt-decode';

const API_URL = import.meta.env.VITE_API_URL || 'https://kumoai.onrender.com/api';

interface LoginCredentials {
    phone: string;
    password: string;
}

interface SignupData {
    schoolName: string;
    adminPhone: string;
    email?: string;
    password: string;
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'BOTH';
    address?: string;
}

interface AuthResponse {
    success: boolean;
    message?: string;
    data?: {
        user: {
            userId: string;
            phone: string;
            role: 'admin' | 'teacher' | 'parent';
            schoolId: string;
            schoolName?: string;
        };
        accessToken: string;
        expiresIn: number;
    };
    error?: string;
}

class AuthService {
    private accessToken: string | null = null;
    private refreshPromise: Promise<string> | null = null;

    constructor() {
        // Try to load token from localStorage on init
        this.accessToken = localStorage.getItem('kumo_access_token');
    }

    getAccessToken(): string | null {
        return this.accessToken;
    }

    setAccessToken(token: string | null) {
        this.accessToken = token;
        if (token) {
            localStorage.setItem('kumo_access_token', token);
        } else {
            localStorage.removeItem('kumo_access_token');
        }
    }

    isTokenExpired(token: string): boolean {
        try {
            const decoded = jwtDecode<{ exp: number }>(token);
            // Check if token expires in less than 5 minutes
            return decoded.exp * 1000 < Date.now() + 5 * 60 * 1000;
        } catch {
            return true;
        }
    }

    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(credentials)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.data?.accessToken) {
                this.setAccessToken(data.data.accessToken);
            }

            if (!data.success) {
                throw new Error(data.error || 'Login failed');
            }

            return data;
        } catch (error: any) {
            if (error.message === 'Failed to fetch') {
                throw new Error('Cannot connect to server. Please check your internet connection.');
            }
            throw error;
        }
    }

    async signup(data: SignupData): Promise<AuthResponse> {
        try {
            console.log('[Auth] Starting signup request to:', `${API_URL}/auth/signup`);
            console.log('[Auth] Request data:', data);

            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            console.log('[Auth] Response status:', response.status);
            console.log('[Auth] Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.log('[Auth] Error response:', errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: `HTTP error! status: ${response.status}` };
                }
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('[Auth] Success response:', result);

            if (result.success && result.data?.accessToken) {
                this.setAccessToken(result.data.accessToken);
                console.log('[Auth] Token saved to localStorage');
            }

            if (!result.success) {
                throw new Error(result.error || 'Signup failed');
            }

            return result;
        } catch (error: any) {
            console.error('[Auth] Signup error:', error);
            if (error.message === 'Failed to fetch') {
                throw new Error('Cannot connect to server. Please check your internet connection.');
            }
            throw error;
        }
    }

    async refreshToken(): Promise<string | null> {
        // If there's already a refresh in progress, return that promise
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data?.accessToken) {
                    this.setAccessToken(data.data.accessToken);
                    return data.data.accessToken;
                }
                throw new Error('Refresh failed');
            })
            .catch(error => {
                this.setAccessToken(null);
                throw error;
            })
            .finally(() => {
                this.refreshPromise = null;
            });

        return this.refreshPromise;
    }

    async logout(): Promise<void> {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${this.accessToken || ''}`
                }
            });
        } finally {
            this.setAccessToken(null);
        }
    }

    async getCurrentUser() {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken || ''}`
            }
        });

        return response.json();
    }

    // Generic authenticated request helper
    async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        let token = this.getAccessToken();

        // Refresh token if expired
        if (token && this.isTokenExpired(token)) {
            try {
                token = await this.refreshToken();
            } catch {
                // Refresh failed, user needs to login again
                window.location.href = '/login';
                throw new Error('Session expired');
            }
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            }
        });

        // Handle 401 by trying to refresh once
        if (response.status === 401 && token) {
            try {
                const newToken = await this.refreshToken();
                const retryResponse = await fetch(`${API_URL}${endpoint}`, {
                    ...options,
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${newToken}`,
                        ...options.headers
                    }
                });
                return retryResponse.json();
            } catch {
                window.location.href = '/login';
                throw new Error('Session expired');
            }
        }

        return response.json();
    }

    // Dashboard API methods
    async getDashboardStats(): Promise<any> {
        return this.request('/dashboard/stats', { method: 'GET' });
    }

    async getSchoolInfo(): Promise<any> {
        return this.request('/schools/me', { method: 'GET' });
    }

    async getTerms(): Promise<any> {
        return this.request('/terms', { method: 'GET' });
    }

    async getSubjects(filters?: { class_level?: string }): Promise<any> {
        const params = new URLSearchParams();
        if (filters?.class_level) params.append('class_level', filters.class_level);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/subjects${query}`, { method: 'GET' });
    }

    async getClasses(): Promise<any> {
        return this.request('/classes', { method: 'GET' });
    }

    async getMarks(filters?: { term_id?: string; class_level?: string; subject?: string }): Promise<any> {
        const params = new URLSearchParams();
        if (filters?.term_id) params.append('term_id', filters.term_id);
        if (filters?.class_level) params.append('class_level', filters.class_level);
        if (filters?.subject) params.append('subject', filters.subject);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/marks${query}`, { method: 'GET' });
    }

    async getStudents(filters?: { class_level?: string; search?: string }): Promise<any> {
        const params = new URLSearchParams();
        if (filters?.class_level) params.append('class_level', filters.class_level);
        if (filters?.search) params.append('search', filters.search);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/students${query}`, { method: 'GET' });
    }

    // Subscription & Payment API methods
    async getSubscriptionStatus(): Promise<any> {
        return this.request('/subscription/status', { method: 'GET' });
    }

    async updateCurrency(currency: string): Promise<any> {
        return this.request('/subscription/currency', { 
            method: 'POST',
            body: JSON.stringify({ currency })
        });
    }

    async getPlans(currency?: string): Promise<any> {
        const params = currency ? `?currency=${currency}` : '';
        return this.request(`/subscription/plans${params}`, { method: 'GET' });
    }

    async initializePayment(plan: string, currency: string): Promise<any> {
        return this.request('/payment/initialize', {
            method: 'POST',
            body: JSON.stringify({ plan, currency })
        });
    }

    async verifyPayment(reference: string): Promise<any> {
        return this.request(`/payment/verify/${reference}`, { method: 'GET' });
    }

    async getPaymentHistory(): Promise<any> {
        return this.request('/payment/history', { method: 'GET' });
    }
}

    async getTeachers(): Promise<any> {
        return this.request('/teachers', { method: 'GET' });
    }

    async getTransactions(filters?: { status?: string }): Promise<any> {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/transactions${query}`, { method: 'GET' });
    }

    async saveMarks(data: { marks: any[]; status?: string }): Promise<any> {
        return this.request('/marks', { 
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateProfile(data: { name?: string; email?: string }): Promise<any> {
        return this.request('/auth/profile', { 
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<any> {
        return this.request('/auth/change-password', { 
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }
}

export const authService = new AuthService();
