import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    onNavigate: (page: string) => void;
}

export function ProtectedRoute({ children, onNavigate }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, user } = useAuth();

    console.log('[ProtectedRoute] isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'user:', user);

    useEffect(() => {
        console.log('[ProtectedRoute] useEffect triggered. isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);
        if (!isLoading && !isAuthenticated) {
            console.log('[ProtectedRoute] Not authenticated, redirecting to login');
            onNavigate('login');
        }
    }, [isAuthenticated, isLoading, onNavigate]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#4a4f55] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-[#ffd700] animate-spin" />
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
