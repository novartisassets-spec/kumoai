/**
 * Universe Templates for African Schools
 * Contains class and subject templates per country and school type
 */

export interface CountryTemplate {
    code: string;
    flag: string;
    currency: string;
    PRIMARY: {
        classes: string[];
        subjects: string[];
    };
    SECONDARY: {
        classes: string[];
        subjects: string[];
    };
    BOTH: {
        classes: string[];
        subjects: string[];
    };
}

export const UNIVERSE_TEMPLATES: Record<string, CountryTemplate> = {
    
    // ═══════════════════════════════════════════════════════════════
    // WEST AFRICA
    // ═══════════════════════════════════════════════════════════════
    
    Nigeria: {
        code: '234',
        flag: '🇳🇬',
        currency: 'NGN',
        PRIMARY: {
            classes: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
            subjects: ['Maths', 'English', 'Basic Science', 'Social Studies', 'C.R.S.', 'Civic', 'Creative Arts', 'Computer', 'P.E.', 'Handwriting', 'Quantitative', 'Verbal']
        },
        SECONDARY: {
            classes: ['JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'],
            subjects: ['Maths', 'English', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government', 'Literature', 'Geography', 'Computer', 'Civic', 'Agric Sci', 'F/Maths', 'Account', 'Commerce']
        },
        BOTH: {
            classes: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'],
            subjects: ['Maths', 'English', 'Basic Science', 'Social Studies', 'C.R.S.', 'Civic', 'Creative Arts', 'Computer', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government', 'Literature', 'Geography', 'Agric Sci']
        }
    },
    
    Ghana: {
        code: '233',
        flag: '🇬🇭',
        currency: 'GHS',
        PRIMARY: {
            classes: ['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'R.M.E.', 'Computing', 'Creative Arts', 'Ghanaian Lang', 'P.E.', 'Writing']
        },
        SECONDARY: {
            classes: ['JHS 1', 'JHS 2', 'JHS 3', 'SHS 1', 'SHS 2', 'SHS 3'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'R.M.E.', 'Computing', 'Career Tech', 'Visual Arts', 'French', 'Ghanaian Lang']
        },
        BOTH: {
            classes: ['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6', 'JHS 1', 'JHS 2', 'JHS 3', 'SHS 1', 'SHS 2', 'SHS 3'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'R.M.E.', 'Computing', 'Creative Arts', 'Ghanaian Lang', 'Visual Arts', 'French']
        }
    },
    
    Benin: {
        code: '229',
        flag: '🇧🇯',
        currency: 'XOF',
        PRIMARY: {
            classes: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'],
            subjects: ['Maths', 'Français', 'Science', 'Histoire-Géo', 'Anglais', 'Informatique', 'Sport', 'Dessin']
        },
        SECONDARY: {
            classes: ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'],
            subjects: ['Maths', 'Français', 'Anglais', 'Physique', 'Chimie', 'SVT', 'Histoire-Géo', 'Philosophie', 'Informatique']
        },
        BOTH: {
            classes: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'],
            subjects: ['Maths', 'Français', 'Anglais', 'Science', 'Physique', 'Chimie', 'Histoire-Géo', 'Informatique']
        }
    },
    
    IvoryCoast: {
        code: '225',
        flag: '🇨🇮',
        currency: 'XOF',
        PRIMARY: {
            classes: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'],
            subjects: ['Maths', 'Français', 'Science', 'Histoire-Géo', 'Anglais', 'Informatique', 'Sport', 'Dessin']
        },
        SECONDARY: {
            classes: ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'],
            subjects: ['Maths', 'Français', 'Anglais', 'Physique', 'Chimie', 'SVT', 'Histoire-Géo', 'Philosophie', 'Informatique']
        },
        BOTH: {
            classes: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'],
            subjects: ['Maths', 'Français', 'Anglais', 'Science', 'Physique', 'Chimie', 'Histoire-Géo', 'Informatique']
        }
    },
    
    Senegal: {
        code: '221',
        flag: '🇸🇳',
        currency: 'XOF',
        PRIMARY: {
            classes: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'],
            subjects: ['Maths', 'Français', 'Science', 'Histoire-Géo', 'Anglais', 'Informatique', 'Sport', 'Dessin']
        },
        SECONDARY: {
            classes: ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'],
            subjects: ['Maths', 'Français', 'Anglais', 'Physique', 'Chimie', 'SVT', 'Histoire-Géo', 'Philosophie', 'Informatique']
        },
        BOTH: {
            classes: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'],
            subjects: ['Maths', 'Français', 'Anglais', 'Science', 'Physique', 'Chimie', 'Histoire-Géo', 'Informatique']
        }
    },
    
    SierraLeone: {
        code: '232',
        flag: '🇸🇱',
        currency: 'SLL',
        PRIMARY: {
            classes: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'R.S.', 'Creative Arts', 'P.E.', 'Agriculture']
        },
        SECONDARY: {
            classes: ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'],
            subjects: ['Maths', 'English', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government', 'Geography', 'Agriculture', 'Literature']
        },
        BOTH: {
            classes: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Geography', 'Agriculture']
        }
    },
    
    Liberia: {
        code: '231',
        flag: '🇱🇷',
        currency: 'LRD',
        PRIMARY: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'P.E.', 'Arts', 'Health Sci']
        },
        SECONDARY: {
            classes: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Geography', 'History', 'Literature']
        },
        BOTH: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Geography', 'History']
        }
    },
    
    // ═══════════════════════════════════════════════════════════════
    // EAST AFRICA
    // ═══════════════════════════════════════════════════════════════
    
    Kenya: {
        code: '254',
        flag: '🇰🇪',
        currency: 'KES',
        PRIMARY: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
            subjects: ['Maths', 'English', 'Kiswahili', 'Science', 'Social Studies', 'CRE', 'Creative Arts', 'P.E.']
        },
        SECONDARY: {
            classes: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Kiswahili', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'CRE', 'Agriculture']
        },
        BOTH: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Kiswahili', 'Science', 'Social Studies', 'Biology', 'Chemistry', 'Physics', 'Geography', 'Agriculture']
        }
    },
    
    Uganda: {
        code: '256',
        flag: '🇺🇬',
        currency: 'UGX',
        PRIMARY: {
            classes: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'CRE', 'P.E.', 'Art', 'Music']
        },
        SECONDARY: {
            classes: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
            subjects: ['Maths', 'English', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Economics', 'Literature', 'Agriculture']
        },
        BOTH: {
            classes: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Agriculture']
        }
    },
    
    Tanzania: {
        code: '255',
        flag: '🇹🇿',
        currency: 'TZS',
        PRIMARY: {
            classes: ['Std 1', 'Std 2', 'Std 3', 'Std 4', 'Std 5', 'Std 6', 'Std 7'],
            subjects: ['Hisabati', 'Kiswahili', 'English', 'Sayansi', 'Maarifa', 'P.E.', 'Arts']
        },
        SECONDARY: {
            classes: ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6'],
            subjects: ['Maths', 'Kiswahili', 'English', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Economics', 'Literature']
        },
        BOTH: {
            classes: ['Std 1', 'Std 2', 'Std 3', 'Std 4', 'Std 5', 'Std 6', 'Std 7', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6'],
            subjects: ['Maths', 'Kiswahili', 'English', 'Sayansi', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography']
        }
    },
    
    Rwanda: {
        code: '250',
        flag: '🇷🇼',
        currency: 'RWF',
        PRIMARY: {
            classes: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
            subjects: ['Maths', 'English', 'Kinyarwanda', 'Science', 'Social Studies', 'French', 'P.E.', 'Arts']
        },
        SECONDARY: {
            classes: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
            subjects: ['Maths', 'English', 'French', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Economics', 'Computer']
        },
        BOTH: {
            classes: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
            subjects: ['Maths', 'English', 'French', 'Science', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Computer']
        }
    },
    
    // ═══════════════════════════════════════════════════════════════
    // SOUTHERN AFRICA
    // ═══════════════════════════════════════════════════════════════
    
    SouthAfrica: {
        code: '27',
        flag: '🇿🇦',
        currency: 'ZAR',
        PRIMARY: {
            classes: ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
            subjects: ['Maths', 'English', 'Afrikaans', 'Science', 'Social Sci', 'Life Skills', 'P.E.', 'Arts']
        },
        SECONDARY: {
            classes: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Afrikaans', 'Physical Sci', 'Life Sci', 'Geography', 'History', 'Accounting', 'Economics', 'CAT']
        },
        BOTH: {
            classes: ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Afrikaans', 'Science', 'Social Sci', 'Physical Sci', 'Life Sci', 'Geography', 'History']
        }
    },
    
    Zambia: {
        code: '260',
        flag: '🇿🇲',
        currency: 'ZMW',
        PRIMARY: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'CRE', 'Creative Arts', 'P.E.', 'Zambian Lang']
        },
        SECONDARY: {
            classes: ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Economics', 'Agriculture', 'Computer']
        },
        BOTH: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'Biology', 'Chemistry', 'Physics', 'Geography', 'Agriculture']
        }
    },
    
    Zimbabwe: {
        code: '263',
        flag: '🇿🇼',
        currency: 'USD',
        PRIMARY: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'Shona', 'Ndebele', 'P.E.', 'Arts']
        },
        SECONDARY: {
            classes: ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6'],
            subjects: ['Maths', 'English', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Economics', 'Literature', 'Accounts']
        },
        BOTH: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6'],
            subjects: ['Maths', 'English', 'Science', 'Social Studies', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Economics']
        }
    },
    
    // ═══════════════════════════════════════════════════════════════
    // NORTH AFRICA
    // ═══════════════════════════════════════════════════════════════
    
    Egypt: {
        code: '20',
        flag: '🇪🇬',
        currency: 'EGP',
        PRIMARY: {
            classes: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
            subjects: ['Maths', 'Arabic', 'English', 'Science', 'Social Studies', 'Religion', 'P.E.', 'Arts']
        },
        SECONDARY: {
            classes: ['Prep 1', 'Prep 2', 'Prep 3', 'Sec 1', 'Sec 2', 'Sec 3'],
            subjects: ['Maths', 'Arabic', 'English', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Philosophy']
        },
        BOTH: {
            classes: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Prep 1', 'Prep 2', 'Prep 3', 'Sec 1', 'Sec 2', 'Sec 3'],
            subjects: ['Maths', 'Arabic', 'English', 'Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography']
        }
    },
    
    Morocco: {
        code: '212',
        flag: '🇲🇦',
        currency: 'MAD',
        PRIMARY: {
            classes: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
            subjects: ['Maths', 'Arabe', 'Français', 'Science', 'Islamique', 'Sport', 'Dessin']
        },
        SECONDARY: {
            classes: ['1ère AC', '2ème AC', '3ème AC', '1ère Bac', '2ème Bac'],
            subjects: ['Maths', 'Arabe', 'Français', 'Anglais', 'Physique', 'Chimie', 'SVT', 'Histoire-Géo', 'Philosophie']
        },
        BOTH: {
            classes: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '1ère AC', '2ème AC', '3ème AC', '1ère Bac', '2ème Bac'],
            subjects: ['Maths', 'Arabe', 'Français', 'Anglais', 'Science', 'Physique', 'Chimie', 'SVT']
        }
    },
    
    Cameroon: {
        code: '237',
        flag: '🇨🇲',
        currency: 'XAF',
        PRIMARY: {
            classes: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'],
            subjects: ['Maths', 'Français', 'English', 'Science', 'Histoire-Géo', 'EMC', 'EPS', 'Arts']
        },
        SECONDARY: {
            classes: ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'],
            subjects: ['Maths', 'Français', 'Anglais', 'Physique', 'Chimie', 'SVT', 'Histoire-Géo', 'Philosophie', 'Économie']
        },
        BOTH: {
            classes: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'],
            subjects: ['Maths', 'Français', 'Anglais', 'Science', 'Physique', 'Chimie', 'SVT', 'Histoire-Géo']
        }
    },
    
    Ethiopia: {
        code: '251',
        flag: '🇪🇹',
        currency: 'ETB',
        PRIMARY: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
            subjects: ['Maths', 'English', 'Amharic', 'Science', 'Social Studies', 'Civics', 'P.E.', 'Arts']
        },
        SECONDARY: {
            classes: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Amharic', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Civics']
        },
        BOTH: {
            classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            subjects: ['Maths', 'English', 'Amharic', 'Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography']
        }
    },
    
    'DR Congo': {
        code: '243',
        flag: '🇨🇩',
        currency: 'CDF',
        PRIMARY: {
            classes: ['1ère', '2ème', '3ème', '4ème', '5ème', '6ème'],
            subjects: ['Maths', 'Français', 'Anglais', 'Sciences', 'Histoire-Géo', 'Morale', 'EPS', 'Arts']
        },
        SECONDARY: {
            classes: ['7ème', '8ème', '9ème', '10ème', '11ème', '12ème'],
            subjects: ['Maths', 'Français', 'Anglais', 'Physique', 'Chimie', 'Biologie', 'Histoire-Géo', 'Philosophie', 'Économie']
        },
        BOTH: {
            classes: ['1ère', '2ème', '3ème', '4ème', '5ème', '6ème', '7ème', '8ème', '9ème', '10ème', '11ème', '12ème'],
            subjects: ['Maths', 'Français', 'Anglais', 'Sciences', 'Physique', 'Chimie', 'Biologie', 'Histoire-Géo']
        }
    }
};

export const DEFAULT_TEMPLATE = UNIVERSE_TEMPLATES.Nigeria;

export function getUniverseTemplate(schoolType: string, country: string) {
    const countryTemplate = UNIVERSE_TEMPLATES[country];
    if (!countryTemplate) {
        console.warn(`Country ${country} not found, defaulting to Nigeria`);
        return DEFAULT_TEMPLATE[schoolType as keyof typeof DEFAULT_TEMPLATE] || DEFAULT_TEMPLATE.SECONDARY;
    }
    return countryTemplate[schoolType as keyof typeof countryTemplate] || countryTemplate.SECONDARY;
}
