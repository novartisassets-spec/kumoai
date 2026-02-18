import { useState, useEffect, useRef, useCallback } from 'react';
import {
    QrCode, Link2, CheckCircle2, AlertCircle,
    RefreshCw, Power, Loader2, Smartphone, Zap,
    Copy, Check, XCircle, Clock, Wifi, WifiHigh, WifiOff,
    ChevronRight, Sparkles,
    SignalZero, SignalLow, SignalMedium
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PhoneInput, isValidPhoneNumber } from './PhoneInput';

// Types for connection state
interface ConnectionStatus {
    schoolId: string;
    schoolName: string;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    botJid?: string;
    adminPhone: string;
    whatsappNumber?: string;
    refreshAttempts: number;
    isLocked: boolean;
    lockedUntil?: string;
    isConnected: boolean;
    connectedAt?: string;
    setupStatus?: string;
}

interface QREvent {
    type: 'connecting' | 'qr' | 'connected' | 'locked' | 'error' | 'pairing-code' | 'pairing-error';
    schoolId?: string;
    qr?: string;
    attempt?: number;
    timestamp?: number;
    botJid?: string;
    lockedUntil?: Date;
    error?: string;
    code?: string;
    phoneNumber?: string;
}

interface PairingCodeData {
    code: string;
    phoneNumber: string;
}

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Signal strength component
function SignalStrength({ level }: { level: number }) {
    const icons = [
        SignalZero,
        SignalLow,
        SignalMedium,
        WifiHigh
    ];
    const Icon = icons[Math.min(level, 3)];
    const colors = [
        'text-red-500',
        'text-orange-500',
        'text-yellow-500',
        'text-green-500'
    ];

    return <Icon className={`w-5 h-5 ${colors[Math.min(level, 3)]}`} />;
}

// QR Code renderer component using canvas
function QRCanvas({ qrCode, animate }: { qrCode: string; animate?: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        if (!qrCode || !canvasRef.current) return;

        const drawQR = async () => {
            try {
                const QRCode = await import('qrcode');
                const canvas = canvasRef.current;
                if (!canvas) return;

                await QRCode.toCanvas(canvas, qrCode, {
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#1a1a1a',
                        light: '#ffffff'
                    }
                });
                setOpacity(1);
            } catch (err) {
                console.error('Failed to render QR:', err);
            }
        };

        drawQR();
    }, [qrCode]);

    return (
        <div className={`transition-all duration-500 ${animate ? 'animate-pulse-slow' : ''}`}>
            <canvas
                ref={canvasRef}
                className="rounded-2xl shadow-2xl"
                style={{
                    width: '100%',
                    maxWidth: '300px',
                    aspectRatio: '1',
                    opacity
                }}
            />
        </div>
    );
}

// Status badge component
function StatusBadge({ status, size = 'md' }: { status: ConnectionStatus['status']; size?: 'sm' | 'md' | 'lg' }) {
    const config: Record<string, { icon: any; color: string }> = {
        disconnected: { icon: WifiOff, color: 'bg-gray-500' },
        connecting: { icon: Wifi, color: 'bg-yellow-500 animate-pulse' },
        connected: { icon: WifiHigh, color: 'bg-green-500' },
        error: { icon: AlertCircle, color: 'bg-red-500' }
    };

    const { icon: Icon, color } = config[status];
    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-2 text-base'
    };

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${color} text-white ${sizes[size]}`}>
            <Icon className={`w-3.5 h-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`} />
            {status === 'connecting' ? 'Connecting...' : status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

// Progress Steps Component
function SetupProgress({ currentStep, steps }: { currentStep: string; steps: { id: string; label: string }[] }) {
    const getStepIndex = (stepId: string) => steps.findIndex(s => s.id === stepId);
    const currentIndex = getStepIndex(currentStep);
    const isComplete = currentStep === 'OPERATIONAL';

    if (isComplete) {
        return (
            <div className="flex items-center gap-2 bg-green-500/10 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-green-400 font-medium">Setup Complete</span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Setup Progress</span>
                <span className="text-white font-medium">{currentIndex + 1} / {steps.length}</span>
            </div>
            <div className="flex gap-2">
                {steps.map((step, index) => (
                    <div
                        key={step.id}
                        className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                            index < currentIndex ? 'bg-green-500' :
                            index === currentIndex ? 'bg-[#ffd700] animate-pulse' :
                            'bg-white/10'
                        }`}
                    />
                ))}
            </div>
            <p className="text-sm text-gray-400">
                Step: <span className="text-white font-medium">{steps[currentIndex]?.label || currentStep}</span>
            </p>
        </div>
    );
}

// Animated Connection Card for Dashboard Overview
export function ConnectAICard({ schoolId, onNavigate }: { schoolId: string; onNavigate: (page: string) => void }) {
    const [status, setStatus] = useState<ConnectionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('kumo_access_token');

    // Don't try to fetch if schoolId is empty
    if (!schoolId) {
        return (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/10" />
                    <div className="flex-1">
                        <div className="h-5 bg-white/10 rounded w-1/3 mb-2" />
                        <div className="h-4 bg-white/10 rounded w-1/4" />
                    </div>
                </div>
            </div>
        );
    }

    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/whatsapp/status/${schoolId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setStatus(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch status:', err);
        } finally {
            setLoading(false);
        }
    }, [schoolId, token]);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    if (loading) {
        return (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 animate-pulse">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/10" />
                    <div className="flex-1">
                        <div className="h-5 bg-white/10 rounded w-1/3 mb-2" />
                        <div className="h-4 bg-white/10 rounded w-1/4" />
                    </div>
                </div>
            </div>
        );
    }

    const isConnected = status?.isConnected || status?.status === 'connected';
    const signalLevel = isConnected ? 3 : status?.status === 'connecting' ? 2 : 0;

    return (
        <div
            className="group relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-2xl border border-white/10 overflow-hidden cursor-pointer transition-all duration-300 hover:border-[#ffd700]/50 hover:shadow-[0_0_30px_rgba(255,215,0,0.1)]"
            onClick={() => onNavigate('connect')}
        >
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#ffd700]/5 via-transparent to-[#7dd3c0]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                            isConnected
                                ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30'
                                : status?.status === 'connecting'
                                    ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30'
                                    : 'bg-gradient-to-br from-white/5 to-white/10 border border-white/10'
                        }`}>
                            <QrCode className={`w-7 h-7 ${
                                isConnected ? 'text-green-400' : status?.status === 'connecting' ? 'text-yellow-400' : 'text-gray-400'
                            }`} />

                            {/* Pulse Animation for connecting */}
                            {status?.status === 'connecting' && (
                                <span className="absolute inset-0 rounded-2xl animate-ping bg-yellow-500/30" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                                Connect AI
                                {isConnected && (
                                    <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                        <SignalStrength level={signalLevel} />
                                        Active
                                    </span>
                                )}
                            </h3>
                            <p className="text-gray-400 text-sm">
                                {isConnected ? 'WhatsApp connected' : status?.status === 'connecting' ? 'Connecting...' : 'Click to setup'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <StatusBadge status={status?.status || 'disconnected'} size="sm" />
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-[#ffd700] group-hover:translate-x-1 transition-all" />
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5">
                    <div className="text-center">
                        <p className={`text-2xl font-bold ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
                            {isConnected ? '✓' : '○'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Connection</p>
                    </div>
                    <div className="text-center">
                        <p className={`text-2xl font-bold ${status?.setupStatus === 'OPERATIONAL' ? 'text-green-400' : 'text-gray-500'}`}>
                            {status?.setupStatus === 'OPERATIONAL' ? '✓' : '○'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Setup</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-[#ffd700]">
                            <Sparkles className="w-6 h-6 mx-auto" />
                        </p>
                        <p className="text-xs text-gray-500 mt-1">AI Ready</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Locked overlay component
function LockedOverlay({ lockedUntil, onReconnect }: {
    lockedUntil?: string;
    onReconnect: () => void
}) {
    const [timeRemaining, setTimeRemaining] = useState<string>('');

    useEffect(() => {
        if (!lockedUntil) return;

        const updateTime = () => {
            const locked = new Date(lockedUntil).getTime();
            const now = Date.now();
            const diff = locked - now;

            if (diff <= 0) {
                setTimeRemaining('00:00');
                return;
            }

            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeRemaining(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [lockedUntil]);

    return (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl rounded-2xl flex flex-col items-center justify-center p-8 z-20 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mb-6 animate-pulse">
                <AlertCircle className="w-10 h-10 text-yellow-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">QR Paused</h3>
            <p className="text-gray-400 text-center mb-4 max-w-xs">
                Too many refresh attempts. Please wait before trying again.
            </p>
            {lockedUntil && (
                <div className="flex items-center gap-2 bg-yellow-500/20 rounded-xl px-4 py-3 mb-6">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-400 font-mono text-xl">{timeRemaining}</span>
                </div>
            )}
            <button
                onClick={onReconnect}
                className="flex items-center gap-2 px-6 py-3 bg-[#ffd700] hover:bg-[#ffed4e] text-black rounded-xl font-medium transition-all hover:scale-105 active:scale-95"
            >
                <RefreshCw className="w-5 h-5" />
                Reset & Try Again
            </button>
        </div>
    );
}

// Main Connect AI Tab - Mobile First
export function ConnectAI() {
    const [status, setStatus] = useState<ConnectionStatus | null>(null);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [qrAttempt, setQrAttempt] = useState(1);
    const eventSourceRef = useRef<EventSource | null>(null);
    
    // Pairing code state
    const [connectionMode, setConnectionMode] = useState<'qr' | 'pairing'>('qr');
    const [pairingCode, setPairingCode] = useState<PairingCodeData | null>(null);
    const [pairingCodeCopied, setPairingCodeCopied] = useState(false);
    const [pairingCodeExpired, setPairingCodeExpired] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [phoneError, setPhoneError] = useState('');

    const { user } = useAuth();
    const schoolId = user?.schoolId;
    const token = localStorage.getItem('kumo_access_token');

    // Debug logging
    useEffect(() => {
        console.log('[ConnectAI] Component mounted', { 
            user: user ? 'present' : 'null', 
            schoolId: schoolId || 'MISSING', 
            token: token ? 'present' : 'null'
        });
    }, []);

    // Handle missing schoolId - show error instead of silently failing
    if (!schoolId) {
        return (
            <div className="min-h-screen bg-[#4a4f55] flex items-center justify-center">
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-md">
                    <h2 className="text-xl font-bold text-red-400 mb-2">School ID Missing</h2>
                    <p className="text-gray-300">
                        Unable to determine your school. Please log out and log in again.
                    </p>
                </div>
            </div>
        );
    }

    // Setup steps
    const setupSteps = [
        { id: 'PENDING_SETUP', label: 'Pending' },
        { id: 'IN_PROGRESS', label: 'In Progress' },
        { id: 'TA_SETUP', label: 'Teacher Setup' },
        { id: 'OPERATIONAL', label: 'Ready' }
    ];

    const fetchStatus = useCallback(async () => {
        console.log('[ConnectAI] Fetching status for school:', schoolId);
        try {
            const response = await fetch(`${API_URL}/whatsapp/status/${schoolId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            console.log('[ConnectAI] Status response:', data);
            if (data.success) {
                setStatus(data.data);
                
                // Pre-fill phone number from saved whatsapp_number
                if (data.data.whatsappNumber && !phoneNumber) {
                    console.log('[ConnectAI] Pre-filling phone number from saved:', data.data.whatsappNumber);
                    setPhoneNumber(data.data.whatsappNumber);
                }
                
                if (data.data.isLocked) {
                    console.log('[ConnectAI] QR generation is locked until:', data.data.lockedUntil);
                }
            } else {
                console.error('[ConnectAI] Status fetch failed:', data.error);
            }
        } catch (err) {
            console.error('[ConnectAI] Failed to fetch status:', err);
            setError('Unable to connect to server. Make sure the backend is running.');
        } finally {
            setLoading(false);
        }
    }, [schoolId, token, phoneNumber]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Handle pairing code expiration (2 minutes)
    useEffect(() => {
        if (pairingCode) {
            setPairingCodeExpired(false);
            const timer = setTimeout(() => {
                console.log('[ConnectAI] Pairing code expired');
                setPairingCodeExpired(true);
            }, 2 * 60 * 1000); // 2 minutes
            
            return () => clearTimeout(timer);
        }
    }, [pairingCode]);

    // Setup EventSource for receiving QR codes - called BEFORE connect
    const setupEventSource = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        console.log('[ConnectAI] Creating EventSource FIRST...');
        const eventSourceUrl = `${API_URL}/whatsapp/connect/${schoolId}?token=${token}`;
        console.log('[ConnectAI] EventSource URL:', eventSourceUrl.substring(0, 50) + '...');
        
        const eventSource = new EventSource(eventSourceUrl);
        eventSourceRef.current = eventSource;
        
        eventSource.onopen = () => {
            console.log('[ConnectAI] EventSource connected - ready to receive QR');
            setStatus(prev => prev ? { ...prev, status: 'connecting' } : prev);
        };
        
        eventSource.onerror = (err) => {
            console.error('[ConnectAI] EventSource error:', err);
            // Don't close immediately - let it retry
        };

        eventSource.onmessage = (event) => {
            console.log('[ConnectAI] SSE message received:', event.data);
            try {
                const data = JSON.parse(event.data) as QREvent;

                switch (data.type) {
                    case 'connecting':
                        console.log('[ConnectAI] Received: connecting');
                        setStatus(prev => prev ? { ...prev, status: 'connecting' } : prev);
                        break;
                    case 'qr':
                        console.log('[ConnectAI] Received QR code, attempt:', data.attempt);
                        if (data.qr) {
                            setQrCode(data.qr);
                            setQrAttempt(data.attempt || 1);
                            setStatus(prev => prev ? { ...prev, status: 'connecting' } : prev);
                            setConnecting(false); // Stop showing connecting spinner, show QR instead
                        }
                        break;
                    case 'connected':
                        console.log('[ConnectAI] Connected!');
                        setQrCode(null);
                        setConnecting(false);
                        setStatus(prev => prev ? {
                            ...prev,
                            status: 'connected',
                            botJid: data.botJid,
                            isConnected: true,
                            connectedAt: new Date().toISOString()
                        } : prev);
                        eventSource.close();
                        break;
                    case 'locked':
                        console.log('[ConnectAI] QR locked');
                        setQrCode(null);
                        setConnecting(false);
                        setStatus(prev => prev ? {
                            ...prev,
                            status: 'disconnected',
                            isLocked: true,
                            lockedUntil: data.lockedUntil?.toISOString()
                        } : prev);
                        eventSource.close();
                        break;
                    case 'error':
                        console.log('[ConnectAI] Error:', data.error);
                        setError(data.error || 'Connection error');
                        setConnecting(false);
                        eventSource.close();
                        break;
                    case 'pairing-code':
                        console.log('[ConnectAI] Received pairing code:', data.code);
                        if (data.code && data.phoneNumber) {
                            setPairingCode({ code: data.code, phoneNumber: data.phoneNumber });
                            setPairingCodeExpired(false); // Reset expiration
                            setConnecting(false);
                        }
                        break;
                    case 'pairing-error':
                        console.log('[ConnectAI] Pairing error:', data.error);
                        setError(data.error || 'Failed to generate pairing code');
                        setConnecting(false);
                        eventSource.close();
                        break;
                }
            } catch (err) {
                console.error('[ConnectAI] Failed to parse SSE:', err);
            }
        };

        return eventSource;
    }, [schoolId, token, API_URL]);

    const connect = async () => {
        console.log('[ConnectAI] Starting connection...', { schoolId, token: token ? 'present' : 'missing' });
        
        if (connecting || (status?.isConnected)) {
            console.log('[ConnectAI] Already connecting or connected, skipping');
            return;
        }

        setConnecting(true);
        setError(null);
        setQrCode(null);
        setQrAttempt(1);

        // CRITICAL: Setup EventSource FIRST to capture all QR emissions
        // Then trigger the connection
        try {
            // Step 1: Open EventSource FIRST (before triggering connection)
            console.log('[ConnectAI] Step 1: Setting up EventSource first...');
            setupEventSource();
            
            // Small delay to ensure EventSource is ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Step 2: Now trigger the connection
            const url = `${API_URL}/whatsapp/connect/${schoolId}`;
            console.log('[ConnectAI] Step 2: Triggering connection...');
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('[ConnectAI] Response status:', response.status);

            const data = await response.json();
            console.log('[ConnectAI] POST response:', data);
            
            if (!data.success) {
                console.log('[ConnectAI] Connection failed:', data.error || 'Unknown error');
                if (data.locked) {
                    setError('QR generation is temporarily locked. Please wait 5 minutes.');
                } else {
                    setError(data.error || 'Failed to start connection');
                }
                setConnecting(false);
                eventSourceRef.current?.close();
                return;
            }

            if (data.connected) {
                console.log('[ConnectAI] Already connected');
                setConnecting(false);
                eventSourceRef.current?.close();
                await fetchStatus();
                return;
            }

            console.log('[ConnectAI] Connection initiated - waiting for QR...');
            // EventSource is already set up and listening, so we should receive QR codes
            
        } catch (err: any) {
            console.error('[ConnectAI] Connection error:', err);
            
            if (err.message === 'Failed to fetch') {
                setError('Cannot connect to server. Please check:\n1. Backend is running on port 3000\n2. No firewall blocking the connection\n3. CORS is properly configured');
            } else {
                setError(err.message || 'Failed to connect');
            }
            setConnecting(false);
            eventSourceRef.current?.close();
        }
    };

    const disconnect = async () => {
        try {
            await fetch(`${API_URL}/whatsapp/disconnect/${schoolId}`, { 
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            await fetchStatus();
        } catch (err) {
            console.error('Failed to disconnect:', err);
        }
    };

    const reconnect = async () => {
        try {
            await fetch(`${API_URL}/whatsapp/reconnect/${schoolId}`, { 
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setStatus(prev => prev ? {
                ...prev,
                isLocked: false,
                lockedUntil: undefined,
                refreshAttempts: 0,
                status: 'disconnected'
            } : prev);
        } catch (err) {
            console.error('Failed to reconnect:', err);
        }
    };

    const refreshQR = async () => {
        if (connecting || status?.isConnected) return;
        try {
            await fetch(`${API_URL}/whatsapp/refresh-qr/${schoolId}`, { 
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (err) {
            console.error('Failed to refresh QR:', err);
        }
    };

    const requestPairingCode = async () => {
        console.log('[ConnectAI] Requesting pairing code...', { schoolId, phoneNumber });
        
        if (connecting || status?.isConnected) {
            console.log('[ConnectAI] Already connecting or connected, skipping');
            return;
        }

        // Validate phone number
        if (!phoneNumber) {
            setPhoneError('Please enter your WhatsApp phone number');
            return;
        }

        if (!isValidPhoneNumber(phoneNumber)) {
            setPhoneError('Please enter a valid phone number');
            return;
        }

        setPhoneError('');
        setConnecting(true);
        setError(null);
        setQrCode(null);
        setPairingCode(null);

        try {
            // Step 1: Open EventSource FIRST (before triggering pairing code request)
            console.log('[ConnectAI] Step 1: Setting up EventSource for pairing code...');
            setupEventSource();
            
            // Small delay to ensure EventSource is ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Step 2: Request pairing code with phone number
            const url = `${API_URL}/whatsapp/request-pairing-code/${schoolId}`;
            console.log('[ConnectAI] Step 2: Requesting pairing code for:', phoneNumber);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ phoneNumber })
            });
            
            console.log('[ConnectAI] Pairing code response status:', response.status);

            const data = await response.json();
            console.log('[ConnectAI] Pairing code POST response:', data);
            
            if (!data.success) {
                console.log('[ConnectAI] Pairing code request failed:', data.error || 'Unknown error');
                setError(data.error || 'Failed to request pairing code');
                setConnecting(false);
                eventSourceRef.current?.close();
                return;
            }

            console.log('[ConnectAI] Pairing code request initiated - waiting for code...');
            // EventSource is already set up and listening, so we should receive the pairing code
            
        } catch (err: any) {
            console.error('[ConnectAI] Pairing code request error:', err);
            
            if (err.message === 'Failed to fetch') {
                setError('Cannot connect to server. Please check:\n1. Backend is running on port 3000\n2. No firewall blocking the connection\n3. CORS is properly configured');
            } else {
                setError(err.message || 'Failed to request pairing code');
            }
            setConnecting(false);
            eventSourceRef.current?.close();
        }
    };

    const copyPairingCode = () => {
        if (pairingCode?.code) {
            navigator.clipboard.writeText(pairingCode.code);
            setPairingCodeCopied(true);
            setTimeout(() => setPairingCodeCopied(false), 2000);
        }
    };

    const copyAdminPhone = () => {
        if (status?.adminPhone) {
            navigator.clipboard.writeText(status.adminPhone);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#4a4f55] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-[#ffd700] animate-spin" />
                    <p className="text-gray-400">Loading connection status...</p>
                </div>
            </div>
        );
    }

    const isConnected = status?.isConnected || status?.status === 'connected';

    return (
        <div className="min-h-screen bg-[#4a4f55]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#4a4f55]/95 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
                                <Smartphone className="w-5 h-5 text-[#ffd700]" />
                            </div>
                            Connect AI
                        </h1>
                        <StatusBadge status={status?.status || 'disconnected'} />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Error Display */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3 animate-slide-up">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                        <button onClick={() => setError(null)}>
                            <XCircle className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                )}

                {/* Connection Card */}
                <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                    {/* Card Header */}
                    <div className="px-6 py-5 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                                    isConnected
                                        ? 'bg-green-500/20 border border-green-500/30'
                                        : status?.status === 'connecting'
                                            ? 'bg-yellow-500/20 border border-yellow-500/30 animate-pulse'
                                            : 'bg-white/10 border border-white/10'
                                }`}>
                                    {isConnected ? (
                                        <WifiHigh className="w-7 h-7 text-green-400" />
                                    ) : status?.status === 'connecting' ? (
                                        <Loader2 className="w-7 h-7 text-yellow-400 animate-spin" />
                                    ) : (
                                        <WifiOff className="w-7 h-7 text-gray-400" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-white font-semibold text-lg">{status?.schoolName || 'School'}</h2>
                                    <p className="text-gray-400 text-sm">WhatsApp Connection</p>
                                </div>
                            </div>
                            {isConnected && (
                                <div className="flex items-center gap-2 text-green-400">
                                    <SignalStrength level={3} />
                                    <span className="text-sm font-medium">Active</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Connection Mode Toggle - Only show when not connected */}
                    {!isConnected && !connecting && !qrCode && !pairingCode && (
                        <div className="px-6 pt-4 space-y-4">
                            <div className="flex items-center justify-center gap-2 bg-white/5 rounded-xl p-1">
                                <button
                                    onClick={() => {
                                        setConnectionMode('qr');
                                        setPhoneNumber('');
                                        setPhoneError('');
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                                        connectionMode === 'qr'
                                            ? 'bg-[#ffd700] text-black font-medium'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <QrCode className="w-4 h-4" />
                                    QR Code
                                </button>
                                <button
                                    onClick={() => setConnectionMode('pairing')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                                        connectionMode === 'pairing'
                                            ? 'bg-[#ffd700] text-black font-medium'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <Smartphone className="w-4 h-4" />
                                    Pairing Code
                                </button>
                            </div>
                            
                            {/* Phone Number Input for Pairing Mode */}
                            {connectionMode === 'pairing' && (
                                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                                    <p className="text-white/70 text-sm text-center">
                                        Enter the WhatsApp number you want to connect
                                    </p>
                                    <PhoneInput
                                        value={phoneNumber}
                                        onChange={(fullNumber) => {
                                            setPhoneNumber(fullNumber);
                                            setPhoneError('');
                                        }}
                                        placeholder="Enter phone number"
                                        label="WhatsApp Number"
                                        error={phoneError}
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* QR / Status Area */}
                    <div className="p-6">
                        <div className="flex flex-col items-center">
                            {/* QR Display */}
                            <div className="relative w-full max-w-[340px] aspect-square bg-white rounded-3xl flex items-center justify-center overflow-hidden">
                                {connecting ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="relative">
                                            <div className="w-28 h-28 rounded-2xl bg-[#ffd700]/10 animate-pulse flex items-center justify-center">
                                                {connectionMode === 'pairing' ? (
                                                    <Smartphone className="w-14 h-14 text-[#ffd700]" />
                                                ) : (
                                                    <QrCode className="w-14 h-14 text-[#ffd700]" />
                                                )}
                                            </div>
                                            <div className="absolute inset-0 rounded-2xl border-2 border-[#ffd700]/30 animate-ping" />
                                        </div>
                                        <p className="text-gray-400">
                                            {connectionMode === 'pairing' ? 'Generating Pairing Code...' : 'Generating QR Code...'}
                                        </p>
                                    </div>
                                ) : pairingCode ? (
                                    <div className={`flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#ffd700]/10 to-[#ffed4e]/5 ${pairingCodeExpired ? 'opacity-60' : ''}`}>
                                        <div className="w-20 h-20 rounded-2xl bg-[#ffd700]/20 flex items-center justify-center mb-4">
                                            <Smartphone className="w-10 h-10 text-[#ffd700]" />
                                        </div>
                                        <p className="text-gray-500 text-sm mb-2">
                                            {pairingCodeExpired ? 'Code Expired' : 'Your Pairing Code'}
                                        </p>
                                        <div className={`rounded-2xl px-8 py-4 mb-4 ${pairingCodeExpired ? 'bg-red-100 line-through' : 'bg-black/5'}`}>
                                            <p className={`text-4xl font-mono font-bold tracking-wider ${pairingCodeExpired ? 'text-red-500' : 'text-[#1a1a1a]'}`}>
                                                {pairingCode.code}
                                            </p>
                                        </div>
                                        <p className="text-gray-400 text-sm text-center mb-4">
                                            {pairingCodeExpired ? (
                                                <span className="text-red-500 font-medium">This code has expired. Request a new one.</span>
                                            ) : (
                                                <>
                                                    Enter this code in WhatsApp on<br/>
                                                    <span className="font-mono text-gray-600">{pairingCode.phoneNumber}</span>
                                                </>
                                            )}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={copyPairingCode}
                                                disabled={pairingCodeExpired}
                                                className="flex items-center gap-2 px-4 py-2 bg-[#ffd700]/20 hover:bg-[#ffd700]/30 text-[#1a1a1a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {pairingCodeCopied ? (
                                                    <>
                                                        <Check className="w-4 h-4" />
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-4 h-4" />
                                                        Copy Code
                                                    </>
                                                )}
                                            </button>
                                            {pairingCodeExpired && (
                                                <button
                                                    onClick={requestPairingCode}
                                                    className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-700 rounded-lg transition-colors"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    New Code
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : status?.isLocked ? (
                                    <LockedOverlay
                                        lockedUntil={status.lockedUntil}
                                        onReconnect={reconnect}
                                    />
                                ) : qrCode ? (
                                    <>
                                        <QRCanvas qrCode={qrCode} animate />
                                    </>
                                ) : isConnected ? (
                                    <div className="flex flex-col items-center gap-4 p-8">
                                        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center animate-bounce-subtle">
                                            <CheckCircle2 className="w-14 h-14 text-green-500" />
                                        </div>
                                        <p className="text-white text-xl font-semibold">Connected!</p>
                                        <p className="text-gray-400 text-center">
                                            Your WhatsApp AI is ready to receive messages
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 p-8">
                                        {connectionMode === 'pairing' ? (
                                            <>
                                                <Smartphone className="w-16 h-16 text-gray-600" />
                                                <p className="text-gray-400 text-center">
                                                    Click "Get Pairing Code" to generate a code
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <QrCode className="w-16 h-16 text-gray-600" />
                                                <p className="text-gray-400 text-center">
                                                    Click "Connect WhatsApp" to generate QR code
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                                {isConnected ? (
                                    <button
                                        onClick={disconnect}
                                        className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-all"
                                    >
                                        <Power className="w-5 h-5" />
                                        Disconnect
                                    </button>
                                ) : (
                                    <>
                                        {connectionMode === 'pairing' ? (
                                            <button
                                                onClick={requestPairingCode}
                                                disabled={connecting || pairingCode !== null}
                                                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#ffd700] to-[#ffed4e] text-black font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                            >
                                                {connecting ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Generating Code...
                                                    </>
                                                ) : pairingCode ? (
                                                    <>
                                                        <CheckCircle2 className="w-5 h-5" />
                                                        Code Generated
                                                    </>
                                                ) : (
                                                    <>
                                                        <Smartphone className="w-5 h-5" />
                                                        Get Pairing Code
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={connect}
                                                disabled={connecting}
                                                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#ffd700] to-[#ffed4e] text-black font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                            >
                                                {connecting ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Connecting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Link2 className="w-5 h-5" />
                                                        Connect WhatsApp
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        {qrCode && !status?.isLocked && (
                                            <button
                                                onClick={refreshQR}
                                                disabled={connecting}
                                                className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                                            >
                                                <RefreshCw className="w-5 h-5" />
                                                Refresh ({qrAttempt}/3)
                                            </button>
                                        )}
                                        {(qrCode || pairingCode) && (
                                            <button
                                                onClick={async () => {
                                                    // First disconnect from backend
                                                    try {
                                                        await fetch(`${API_URL}/whatsapp/disconnect/${schoolId}`, { 
                                                            method: 'POST',
                                                            headers: {
                                                                'Authorization': `Bearer ${token}`
                                                            }
                                                        });
                                                    } catch (err) {
                                                        console.error('Failed to disconnect:', err);
                                                    }
                                                    
                                                    // Then clear local state
                                                    setQrCode(null);
                                                    setPairingCode(null);
                                                    setConnectionMode('qr');
                                                    setError(null);
                                                    
                                                    // Close EventSource
                                                    eventSourceRef.current?.close();
                                                    
                                                    // Refresh status
                                                    await fetchStatus();
                                                }}
                                                disabled={connecting}
                                                className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                                            >
                                                <RefreshCw className="w-5 h-5" />
                                                Start Over
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info Section */}
                    <div className="px-6 pb-6 space-y-4">
                        {/* Admin Phone */}
                        <div className="bg-white/5 rounded-xl p-4">
                            <p className="text-gray-400 text-xs mb-2">Admin Phone</p>
                            <div className="flex items-center justify-between">
                                <span className="text-white font-mono">{status?.adminPhone}</span>
                                <button
                                    onClick={copyAdminPhone}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    {copied ? (
                                        <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Connected At */}
                        {status?.connectedAt && (
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-gray-400 text-xs mb-1">Connected Since</p>
                                <span className="text-white">
                                    {new Date(status.connectedAt).toLocaleString()}
                                </span>
                            </div>
                        )}

                        {/* Setup Progress */}
                        <div className="bg-white/5 rounded-xl p-4">
                            <SetupProgress
                                currentStep={status?.setupStatus || 'PENDING_SETUP'}
                                steps={setupSteps}
                            />
                        </div>

                        {/* Refresh Attempts */}
                        <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
                            <span className="text-gray-400 text-sm">QR Refresh Attempts</span>
                            <div className="flex items-center gap-2">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                                            i <= (status?.refreshAttempts || 0)
                                                ? 'bg-[#ffd700] text-black'
                                                : 'bg-white/10 text-gray-500'
                                        }`}
                                    >
                                        {i}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                {!isConnected && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
                        <h3 className="text-blue-400 font-semibold flex items-center gap-2 mb-4">
                            <Zap className="w-5 h-5" />
                            How to Connect
                        </h3>
                        <ol className="text-gray-300 space-y-3 list-decimal list-inside">
                            <li>Click "Connect WhatsApp" to generate QR code</li>
                            <li>Open WhatsApp on your school's number</li>
                            <li>Go to Linked Devices → Link a Device</li>
                            <li>Scan the QR code with your phone</li>
                            <li>Wait for connection confirmation</li>
                        </ol>
                    </div>
                )}

                {/* Locked Notice */}
                {status?.isLocked && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Clock className="w-6 h-6 text-yellow-500" />
                            <div>
                                <p className="text-yellow-400 font-medium">QR Generation Paused</p>
                                <p className="text-gray-400 text-sm">
                                    Too many refresh attempts. Reset to continue.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={reconnect}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConnectAI;
