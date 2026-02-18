import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authService } from '../lib/auth';
import { jwtDecode } from 'jwt-decode';

interface User {
    userId: string;
    phone: string;
    role: 'admin' | 'teacher' | 'parent';
    schoolId: string;
    schoolName?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (phone: string, password: string) => Promise<void>;
    signup: (data: SignupData) => Promise<void>;
    logout: () => Promise<void>;
    error: string | null;
    clearError: () => void;
}

interface SignupData {
    schoolName: string;
    adminPhone: string;
    email?: string;
    password: string;
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'BOTH';
    address?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check for existing session on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = authService.getAccessToken();
            if (token) {
                try {
                    // Check if token is valid and not expired
                    if (!authService.isTokenExpired(token)) {
                        const decoded = jwtDecode<User>(token);
                        setUser(decoded);
                    } else {
                        // Try to refresh
                        await authService.refreshToken();
                        const newToken = authService.getAccessToken();
                        if (newToken) {
                            const decoded = jwtDecode<User>(newToken);
                            setUser(decoded);
                        }
                    }
                } catch (err) {
                    console.error('Auth initialization failed:', err);
                    authService.setAccessToken(null);
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (phone: string, password: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await authService.login({ phone, password });

            if (result.success && result.data?.user) {
                setUser(result.data.user);
            } else {
                throw new Error(result.error || 'Login failed');
            }
        } catch (err: any) {
            setError(err.message || 'Invalid phone number or password');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const signup = async (data: SignupData) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await authService.signup(data);

            if (result.success && result.data?.user) {
                setUser(result.data.user);
            } else {
                throw new Error(result.error || 'Signup failed');
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to create account';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        try {
            await authService.logout();
            setUser(null);
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const clearError = () => setError(null);

    const value: AuthContextType = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        error,
        clearError
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
