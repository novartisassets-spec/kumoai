/**
 * Country Detection Utility
 * Detects African country from phone number prefix
 */

const COUNTRY_CODES: Record<string, { name: string; code: string }> = {
    '234': { name: 'Nigeria', code: 'NG' },
    '233': { name: 'Ghana', code: 'GH' },
    '229': { name: 'Benin', code: 'BJ' },
    '225': { name: 'IvoryCoast', code: 'CI' },
    '221': { name: 'Senegal', code: 'SN' },
    '232': { name: 'SierraLeone', code: 'SL' },
    '231': { name: 'Liberia', code: 'LR' },
    '254': { name: 'Kenya', code: 'KE' },
    '256': { name: 'Uganda', code: 'UG' },
    '255': { name: 'Tanzania', code: 'TZ' },
    '250': { name: 'Rwanda', code: 'RW' },
    '27': { name: 'SouthAfrica', code: 'ZA' },
    '260': { name: 'Zambia', code: 'ZM' },
    '263': { name: 'Zimbabwe', code: 'ZW' },
    '20': { name: 'Egypt', code: 'EG' },
    '212': { name: 'Morocco', code: 'MA' },
    '237': { name: 'Cameroon', code: 'CM' },
    '251': { name: 'Ethiopia', code: 'ET' },
    '243': { name: 'DR Congo', code: 'CD' },
    '248': { name: 'Seychelles', code: 'SC' },
    '230': { name: 'Mauritius', code: 'MU' },
    '269': { name: 'Comoros', code: 'KM' },
    '258': { name: 'Mozambique', code: 'MZ' },
    '264': { name: 'Namibia', code: 'NA' },
    '267': { name: 'Botswana', code: 'BW' },
    '266': { name: 'Lesotho', code: 'LS' },
    '265': { name: 'Malawi', code: 'MW' },
};

export function detectCountryFromPhone(phone: string): string {
    if (!phone) return 'Nigeria';
    
    const digits = phone.replace(/\D/g, '');
    
    for (const [code, info] of Object.entries(COUNTRY_CODES)) {
        if (digits.startsWith(code)) {
            return info.name;
        }
    }
    
    return 'Nigeria';
}

export function getCountryInfo(phone: string): { name: string; code: string } | null {
    if (!phone) return null;
    
    const digits = phone.replace(/\D/g, '');
    
    for (const [code, info] of Object.entries(COUNTRY_CODES)) {
        if (digits.startsWith(code)) {
            return info;
        }
    }
    
    return null;
}
