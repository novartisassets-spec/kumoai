import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initialize from existing value
    useEffect(() => {
        if (value) {
            // Try to extract country code from the full number
            const matchedCountry = countries.find(c => value.startsWith(c.code.replace('+', '')));
            if (matchedCountry) {
                setSelectedCountry(matchedCountry);
                setPhoneNumber(value.replace(matchedCountry.code.replace('+', ''), ''));
            } else {
                setPhoneNumber(value.replace(/^\+/, ''));
            }
        }
    }, []);

    const filteredCountries = countries.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.includes(searchQuery) ||
        c.iso.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCountrySelect = (country: Country) => {
        setSelectedCountry(country);
        setSearchQuery('');
        setIsDropdownOpen(false);
        
        // Update full number with new country code
        const newNumber = phoneNumber ? `${country.code.replace('+', '')}${phoneNumber}` : '';
        onChange(newNumber);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.replace(/\D/g, ''); // Only digits
        setPhoneNumber(input);
        
        // Update full number
        const fullNumber = input ? `${selectedCountry.code.replace('+', '')}${input}` : '';
        onChange(fullNumber);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-1.5">
            {label && (
                <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                    {label}
                    {required && <span className="text-red-400">*</span>}
                </label>
            )}
            
            <div className="relative" ref={dropdownRef}>
                {/* Country Selector Button */}
                <button
                    type="button"
                    onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
                    disabled={disabled}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                        disabled 
                            ? 'opacity-50 cursor-not-allowed' 
                            : 'hover:bg-white/10 cursor-pointer'
                    }`}
                >
                    <span className="text-lg">{selectedCountry.flag}</span>
                    <span className="text-white/70 text-sm font-medium">{selectedCountry.code}</span>
                    <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Phone Input */}
                <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className={`w-full auth-input pl-28 ${error ? 'border-red-500 focus:border-red-500' : ''}`}
                />

                {/* Clear Button */}
                {phoneNumber && !disabled && (
                    <button
                        type="button"
                        onClick={() => {
                            setPhoneNumber('');
                            onChange('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}

                {/* Country Dropdown */}
                {isDropdownOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-[#2a2d32] border border-white/10 rounded-xl shadow-2xl max-h-80 overflow-hidden">
                        {/* Search */}
                        <div className="p-2 border-b border-white/10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search country..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#ffd700]"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Countries List */}
                        <div className="overflow-y-auto max-h-64">
                            {filteredCountries.map((country) => (
                                <button
                                    key={country.iso}
                                    type="button"
                                    onClick={() => handleCountrySelect(country)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors ${
                                        selectedCountry.iso === country.iso ? 'bg-[#ffd700]/10' : ''
                                    }`}
                                >
                                    <span className="text-xl">{country.flag}</span>
                                    <span className="text-white flex-1 text-left">{country.name}</span>
                                    <span className="text-white/50 text-sm">{country.code}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Display formatted value below input */}
            {phoneNumber && (
                <p className="text-white/40 text-xs">
                    Full: {selectedCountry.flag} {selectedCountry.code} {phoneNumber}
                </p>
            )}

            {/* Error message */}
            {error && (
                <p className="text-red-400 text-xs">{error}</p>
            )}
        </div>
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
    
    // If no match, just add + prefix
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
