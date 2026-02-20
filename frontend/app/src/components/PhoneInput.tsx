import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import { ChevronDown, Search, X, Globe } from 'lucide-react';
import { countries, defaultCountry } from '../lib/countries';
import type { Country } from '../lib/countries';

interface PhoneInputProps {
    value: string;
    onChange: (fullPhoneNumber: string) => void;
    placeholder?: string;
    label?: string;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    defaultCountryCode?: string;
}

// Constants for recent countries
const RECENT_COUNTRIES_KEY = 'recent-countries';
const MAX_RECENT_COUNTRIES = 3;

export function PhoneInput({
    value,
    onChange,
    placeholder = 'Enter phone number',
    label,
    error,
    disabled = false,
    required = false,
    defaultCountryCode
}: PhoneInputProps) {
    const [selectedCountry, setSelectedCountry] = useState<Country>(
        defaultCountryCode 
            ? countries.find(c => c.code === defaultCountryCode) || defaultCountry
            : defaultCountry
    );
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [recentCountries, setRecentCountries] = useState<Country[]>([]);
    const [isMobile, setIsMobile] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Check if mobile on mount and resize
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Load recent countries from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(RECENT_COUNTRIES_KEY);
            if (stored) {
                const codes = JSON.parse(stored) as string[];
                const recent = codes
                    .map(code => countries.find(c => c.code === code))
                    .filter((c): c is Country => c !== undefined);
                setRecentCountries(recent);
            }
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    // Save country to recent list
    const saveToRecent = useCallback((country: Country) => {
        try {
            const stored = localStorage.getItem(RECENT_COUNTRIES_KEY);
            let recent = stored ? JSON.parse(stored) as string[] : [];
            
            // Remove if already exists
            recent = recent.filter(code => code !== country.code);
            // Add to beginning
            recent.unshift(country.code);
            // Keep only max
            recent = recent.slice(0, MAX_RECENT_COUNTRIES);
            
            localStorage.setItem(RECENT_COUNTRIES_KEY, JSON.stringify(recent));
            setRecentCountries(recent
                .map(code => countries.find(c => c.code === code))
                .filter((c): c is Country => c !== undefined)
            );
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    // Initialize from existing value
    useEffect(() => {
        if (value) {
            const matchedCountry = countries.find(c => 
                value.startsWith(c.code.replace('+', ''))
            );
            if (matchedCountry) {
                setSelectedCountry(matchedCountry);
                setPhoneNumber(value.replace(matchedCountry.code.replace('+', ''), ''));
            } else {
                setPhoneNumber(value.replace(/^\+/, ''));
            }
        }
    }, []);

    // Focus search when opening
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Handle body scroll lock when modal is open
    useEffect(() => {
        if (isMobile && isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobile, isOpen]);

    const filteredCountries = countries.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.includes(searchQuery) ||
        c.iso.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCountrySelect = (country: Country) => {
        setSelectedCountry(country);
        saveToRecent(country);
        setSearchQuery('');
        setIsOpen(false);
        
        const newNumber = phoneNumber ? `${country.code.replace('+', '')}${phoneNumber}` : '';
        onChange(newNumber);
    };

    const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.replace(/\D/g, '');
        setPhoneNumber(input);
        
        const fullNumber = input ? `${selectedCountry.code.replace('+', '')}${input}` : '';
        onChange(fullNumber);
    };

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    // Close dropdown when clicking outside (desktop only)
    useEffect(() => {
        if (isMobile) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMobile]);

    return (
        <div className="phone-input-container space-y-2">
            {label && (
                <label className="text-white/80 text-sm font-medium flex items-center gap-2">
                    {label}
                    {required && <span className="text-[#ffd700]">*</span>}
                </label>
            )}
            
            <div 
                className={`phone-input-wrapper relative flex items-center gap-0 bg-black/30 border rounded-xl overflow-hidden transition-all duration-300 ${
                    error 
                        ? 'border-red-500/50 shadow-[0_0_0_3px_rgba(239,68,68,0.1)]' 
                        : 'border-white/10 focus-within:border-[#ffd700]/50 focus-within:bg-black/40 focus-within:shadow-[0_0_20px_rgba(255,215,0,0.1)]'
                } ${disabled ? 'opacity-60' : ''}`}
            >
                {/* Country Selector Button */}
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`country-selector flex items-center gap-2 px-4 py-3.5 bg-gradient-to-r from-white/5 to-transparent border-r border-white/10 transition-all duration-300 min-w-[100px] justify-center ${
                        disabled 
                            ? 'cursor-not-allowed' 
                            : 'cursor-pointer hover:bg-white/10 active:scale-95'
                    } ${isOpen ? 'bg-white/10' : ''}`}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="text-2xl filter drop-shadow-sm" role="img" aria-label={selectedCountry.name}>
                        {selectedCountry.flag}
                    </span>
                    <span className="text-white/90 text-sm font-semibold tracking-wide">
                        {selectedCountry.code}
                    </span>
                    <ChevronDown 
                        className={`w-4 h-4 text-white/60 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
                    />
                </button>

                {/* Phone Input */}
                <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className="phone-input flex-1 bg-transparent border-none px-4 py-3.5 text-white text-base placeholder:text-white/30 focus:outline-none disabled:cursor-not-allowed"
                    style={{ minHeight: '56px' }}
                />

                {/* Clear Button */}
                {phoneNumber && !disabled && (
                    <button
                        type="button"
                        onClick={() => {
                            setPhoneNumber('');
                            onChange('');
                        }}
                        className="clear-btn mr-3 p-2 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-all duration-200 active:scale-90"
                        aria-label="Clear phone number"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Error message */}
            {error && (
                <p className="text-red-400 text-xs flex items-center gap-1 animate-pulse">
                    <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                    {error}
                </p>
            )}

            {/* Desktop Dropdown */}
            {!isMobile && isOpen && (
                <div 
                    ref={dropdownRef}
                    className="country-dropdown absolute z-50 mt-2 w-full max-w-sm bg-[#1a1d21]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-dropdown-in"
                    role="listbox"
                >
                    <DropdownContent 
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        searchInputRef={searchInputRef}
                        filteredCountries={filteredCountries}
                        recentCountries={recentCountries}
                        selectedCountry={selectedCountry}
                        handleCountrySelect={handleCountrySelect}
                    />
                </div>
            )}

            {/* Mobile Bottom Sheet */}
            {isMobile && isOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
                        onClick={() => {
                            setIsOpen(false);
                            setSearchQuery('');
                        }}
                    />
                    
                    {/* Bottom Sheet */}
                    <div 
                        className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1d21] rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Select country"
                    >
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                        </div>
                        
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                                <Globe className="w-5 h-5 text-[#ffd700]" />
                                Select Country
                            </h3>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setSearchQuery('');
                                }}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5 text-white/60" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden">
                            <DropdownContent 
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                searchInputRef={searchInputRef}
                                filteredCountries={filteredCountries}
                                recentCountries={recentCountries}
                                selectedCountry={selectedCountry}
                                handleCountrySelect={handleCountrySelect}
                                isMobile={true}
                            />
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes dropdown-in {
                    from {
                        opacity: 0;
                        transform: translateY(-10px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
                
                .animate-dropdown-in {
                    animation: dropdown-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
                
                .animate-slide-up {
                    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                
                /* Custom scrollbar for dropdown */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                }
                
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                }
                
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                
                /* Ensure dropdown doesn't cause layout issues */
                .phone-input-container {
                    position: relative;
                }
            `}</style>
        </div>
    );
}

// Dropdown Content Component
interface DropdownContentProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchInputRef: { current: HTMLInputElement | null };
    filteredCountries: Country[];
    recentCountries: Country[];
    selectedCountry: Country;
    handleCountrySelect: (country: Country) => void;
    isMobile?: boolean;
}

function DropdownContent({
    searchQuery,
    setSearchQuery,
    searchInputRef,
    filteredCountries,
    recentCountries,
    selectedCountry,
    handleCountrySelect,
    isMobile = false
}: DropdownContentProps) {
    return (
        <>
            {/* Search */}
            <div className={`${isMobile ? 'p-4' : 'p-3'} border-b border-white/10 bg-white/5`}>
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search country or code..."
                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-11 pr-10 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffd700]/50 focus:bg-black/40 transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4 text-white/40" />
                        </button>
                    )}
                </div>
            </div>

            {/* Countries List */}
            <div className={`overflow-y-auto custom-scrollbar ${isMobile ? 'max-h-[60vh]' : 'max-h-80'}`}>
                {/* Recent Countries Section */}
                {!searchQuery && recentCountries.length > 0 && (
                    <div className="py-2">
                        <div className="px-4 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">
                            Recent
                        </div>
                        {recentCountries.map((country) => (
                            <CountryItem
                                key={`recent-${country.iso}`}
                                country={country}
                                isSelected={selectedCountry.iso === country.iso}
                                onSelect={() => handleCountrySelect(country)}
                                isMobile={isMobile}
                            />
                        ))}
                        <div className="mx-4 my-2 h-px bg-white/10"></div>
                    </div>
                )}

                {/* All Countries */}
                <div className="py-2">
                    {!searchQuery && (
                        <div className="px-4 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">
                            All Countries
                        </div>
                    )}
                    {filteredCountries.length === 0 ? (
                        <div className="px-4 py-8 text-center text-white/40">
                            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No countries found</p>
                        </div>
                    ) : (
                        filteredCountries.map((country) => (
                            <CountryItem
                                key={country.iso}
                                country={country}
                                isSelected={selectedCountry.iso === country.iso}
                                onSelect={() => handleCountrySelect(country)}
                                isMobile={isMobile}
                            />
                        ))
                    )}
                </div>
            </div>
        </>
    );
}

// Country Item Component
interface CountryItemProps {
    country: Country;
    isSelected: boolean;
    onSelect: () => void;
    isMobile: boolean;
}

function CountryItem({ country, isSelected, onSelect, isMobile }: CountryItemProps) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full flex items-center gap-4 px-4 py-3.5 transition-all duration-200 ${
                isSelected 
                    ? 'bg-gradient-to-r from-[#ffd700]/20 to-transparent border-l-2 border-[#ffd700]' 
                    : 'hover:bg-white/5 border-l-2 border-transparent'
            } ${isMobile ? 'active:scale-[0.98]' : ''}`}
            role="option"
            aria-selected={isSelected}
        >
            <span className="text-2xl filter drop-shadow-md" role="img" aria-label={country.name}>
                {country.flag}
            </span>
            <span className={`flex-1 text-left text-base ${isSelected ? 'text-white font-medium' : 'text-white/80'}`}>
                {country.name}
            </span>
            <span className={`text-sm font-mono ${isSelected ? 'text-[#ffd700]' : 'text-white/50'}`}>
                {country.code}
            </span>
            {isSelected && (
                <div className="w-2 h-2 bg-[#ffd700] rounded-full shadow-[0_0_8px_rgba(255,215,0,0.8)]"></div>
            )}
        </button>
    );
}

// Helper function to format phone number for display
export function formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    
    const country = countries.find(c => phone.startsWith(c.code.replace('+', '')));
    if (country) {
        const number = phone.replace(country.code.replace('+', ''), '');
        return `${country.flag} ${country.code} ${number}`;
    }
    
    return `+${phone}`;
}

// Helper function to get just the digits
export function getPhoneDigits(phone: string): string {
    return phone.replace(/\D/g, '');
}

// Helper function to check if phone is valid
export function isValidPhoneNumber(phone: string): boolean {
    const digits = getPhoneDigits(phone);
    return digits.length >= 8 && digits.length <= 15;
}
