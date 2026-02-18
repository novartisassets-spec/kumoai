/**
 * Centralized Phone Number Normalization
 * Ensures consistent phone format across the entire system
 */

export class PhoneNormalizer {
    /**
     * Normalize phone number to E.164-like format
     * Examples:
     *   "+2348012345678" → "2348012345678"
     *   "08012345678" → "2348012345678"
     *   "2348012345678" → "2348012345678"
     *   "447415039884" → "447415039884" (international, keep as-is)
     */
    static normalize(phone: string): string {
        if (!phone) return '';
        
        // Remove all non-digits
        let normalized = phone.replace(/\D/g, '');
        
        // Handle Nigerian numbers (10 digits starting with 0)
        if (normalized.length === 10 && normalized.startsWith('0')) {
            normalized = '234' + normalized.substring(1);
        }
        
        // Remove leading + if present (already handled by \D removal)
        // For any other format, keep as-is (already has country code or is valid)
        return normalized;
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
     *   "2348012345678@g.us" → "2348012345678"
     *   "2348012345678@lid" → "2348012345678"
     */
    static fromJID(jid: string): string {
        if (!jid) return '';
        return jid.split('@')[0];
    }
}

