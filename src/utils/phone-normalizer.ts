import { CONSTANTS } from '../config/constants';

/**
 * Centralized Phone Number Normalization
 * Ensures consistent phone format across the entire system
 * Robust and world-wide acceptable
 */

export class PhoneNormalizer {
    /**
     * Normalize phone number to digits-only format (E.164-like but without +)
     * Compatible with WhatsApp JID formats and world-wide use.
     * 
     * Logic:
     * 1. If it's a JID, extract digits part.
     * 2. If it starts with '+', keep all digits.
     * 3. If it starts with '0' and has local length (e.g. 10), prepend default country code.
     * 4. Else, strip all non-digits and keep as-is.
     * 
     * Examples (assuming default '234'):
     *   "+2348012345678" → "2348012345678"
     *   "08012345678" → "2348012345678"
     *   "2348012345678@s.whatsapp.net" → "2348012345678"
     *   "+1 555 123 4567" → "15551234567"
     */
    static normalize(phone: string, defaultCC?: string): string {
        if (!phone) return '';
        
        const cc = defaultCC || CONSTANTS.PHONE.DEFAULT_COUNTRY_CODE;
        
        // Handle WhatsApp JID
        let raw = phone;
        if (phone.includes('@')) {
            raw = this.fromJID(phone);
        }
        
        // Remove non-digits
        const digitsOnly = raw.replace(/\D/g, '');
        
        // Detect local format (starts with 0 and has reasonable length)
        // Nigerian local is 11 digits starting with 0, but common standard is 10 digits after 0.
        // We handle 10-11 digits starting with 0 as local.
        if (raw.trim().startsWith('0') && digitsOnly.length >= 10 && digitsOnly.length <= 11) {
            return cc + digitsOnly.substring(1);
        }
        
        // If it was an E.164 (+ prefix) or already had a country code, digitsOnly is correct
        return digitsOnly;
    }

    /**
     * Check if two phone numbers match (after normalization)
     */
    static matches(phone1: string, phone2: string): boolean {
        return this.normalize(phone1) === this.normalize(phone2);
    }

    /**
     * Extract phone from WhatsApp JID format
     * Examples:
     *   "2348012345678@s.whatsapp.net" → "2348012345678"
     *   "2348012345678:4@s.whatsapp.net" → "2348012345678"
     */
    static fromJID(jid: string): string {
        if (!jid) return '';
        const raw = jid.split('@')[0];
        return raw.split(':')[0];
    }
}

