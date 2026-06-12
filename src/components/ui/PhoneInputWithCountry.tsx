import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../hooks/useLanguage';

interface CountryData {
    name: string;
    commonName: string;
    code: string;
    dialCode: string;
    flag: string;
}

interface PhoneInputWithCountryProps {
    value: string;
    onChange: (value: string) => void;
    onCountryChange: (countryName: string) => void;
    countryName?: string;
    error?: string;
    label: string;
    required?: boolean;
}

const FALLBACK_PHONE_COUNTRIES: CountryData[] = [
    { name: "Brasil", commonName: "Brazil", code: "BR", dialCode: "+55", flag: "https://flagcdn.com/w320/br.png" },
    { name: "Portugal", commonName: "Portugal", code: "PT", dialCode: "+351", flag: "https://flagcdn.com/w320/pt.png" },
    { name: "Estados Unidos", commonName: "United States", code: "US", dialCode: "+1", flag: "https://flagcdn.com/w320/us.png" },
    { name: "Espanha", commonName: "Spain", code: "ES", dialCode: "+34", flag: "https://flagcdn.com/w320/es.png" },
    { name: "Itália", commonName: "Italy", code: "IT", dialCode: "+39", flag: "https://flagcdn.com/w320/it.png" },
    { name: "Alemanha", commonName: "Germany", code: "DE", dialCode: "+49", flag: "https://flagcdn.com/w320/de.png" },
    { name: "França", commonName: "France", code: "FR", dialCode: "+33", flag: "https://flagcdn.com/w320/fr.png" },
    { name: "Reino Unido", commonName: "United Kingdom", code: "GB", dialCode: "+44", flag: "https://flagcdn.com/w320/gb.png" },
    { name: "Argentina", commonName: "Argentina", code: "AR", dialCode: "+54", flag: "https://flagcdn.com/w320/ar.png" },
    { name: "Chile", commonName: "Chile", code: "CL", dialCode: "+56", flag: "https://flagcdn.com/w320/cl.png" },
    { name: "Uruguai", commonName: "Uruguay", code: "UY", dialCode: "+598", flag: "https://flagcdn.com/w320/uy.png" }
];

export const PhoneInputWithCountry: React.FC<PhoneInputWithCountryProps> = ({
    value,
    onChange,
    onCountryChange,
    countryName,
    error,
    label,
    required
}) => {
    const { t, language } = useLanguage();
    const [countries, setCountries] = useState<CountryData[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const response = await fetch('https://restcountries.com/v3.1/all?fields=name,idd,flags,cca2,translations');
                const data = await response.json();

                const formatted: CountryData[] = data
                    .map((c: any) => {
                        const langKey = language === 'en' ? 'eng' : language === 'es' ? 'spa' : 'por';
                        const translatedName = c.translations?.[langKey]?.common || c.name.common;

                        return {
                            name: translatedName,
                            commonName: c.name.common,
                            code: c.cca2,
                            dialCode: c.idd?.root ? (c.idd.root + (c.idd.suffixes?.length === 1 ? c.idd.suffixes[0] : '')) : '',
                            flag: c.flags.svg || c.flags.png
                        };
                    })
                    .filter((c: CountryData) => c.dialCode !== '')
                    .sort((a: CountryData, b: CountryData) => {
                        // Keep Brazil at the top
                        if (a.code === 'BR') return -1;
                        if (b.code === 'BR') return 1;

                        const dialA = parseInt(a.dialCode.replace(/\D/g, '')) || 0;
                        const dialB = parseInt(b.dialCode.replace(/\D/g, '')) || 0;

                        // If same dial code (like +1), prioritize USA
                        if (dialA === dialB) {
                            if (a.code === 'US') return -1;
                            if (b.code === 'US') return 1;
                        }

                        if (dialA !== dialB) return dialA - dialB;
                        return a.name.localeCompare(b.name);
                    });

                setCountries(formatted);

                // Set default as Brasil if none selected
                if (!selectedCountry) {
                    const brazil = formatted.find(c => c.code === 'BR');
                    if (brazil) {
                        setSelectedCountry(brazil);
                    }
                }
            } catch (err) {
                console.error('Error fetching countries, using fallback list:', err);
                setCountries(FALLBACK_PHONE_COUNTRIES);
                if (!selectedCountry) {
                    const brazil = FALLBACK_PHONE_COUNTRIES.find(c => c.code === 'BR');
                    if (brazil) {
                        setSelectedCountry(brazil);
                    }
                }
            }
        };

        fetchCountries();
    }, [language]);

    useEffect(() => {
        if (countryName && countries.length > 0) {
            const country = countries.find(c =>
                c.name === countryName ||
                c.commonName === countryName
            );
            if (country && country.dialCode !== selectedCountry?.dialCode) {
                setSelectedCountry(country);
            }
        }
    }, [countryName, countries]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCountries = countries.filter(c => {
        const search = searchTerm.toLowerCase();
        const mainMatch = c.name.toLowerCase().includes(search) || c.dialCode.includes(search);

        // Custom Aliases
        const aliasMatch =
            (c.commonName === 'United States' && ('eua'.includes(search) || 'estados unidos'.includes(search))) ||
            (c.commonName === 'United Kingdom' && ('inglaterra'.includes(search) || 'reino unido'.includes(search)));

        return mainMatch || aliasMatch;
    });

    const maskPhone = (val: string, dialCode: string) => {
        const digits = val.replace(/\D/g, '');

        if (dialCode === '+55') { // Brazil
            if (digits.length <= 2) return digits;
            if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
        }

        if (dialCode === '+1') { // USA / Canada
            if (digits.length <= 3) return digits;
            if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
        }

        // Generic Spacing for others
        if (digits.length <= 4) return digits;
        if (digits.length <= 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
        return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    };

    const handlePhoneChange = (val: string) => {
        const dialCode = selectedCountry?.dialCode || '';
        onChange(maskPhone(val, dialCode));
    };

    const handleCountrySelect = (country: CountryData) => {
        setSelectedCountry(country);
        onCountryChange(country.name);
        setIsOpen(false);
        setSearchTerm('');

        // Try to re-mask existing value with new country rules
        onChange(maskPhone(value, country.dialCode));
    };

    return (
        <div className="space-y-1.5 relative">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>

            <div className="flex gap-2">
                {/* Dial Code Selector */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={`h-full px-4 border-2 rounded-2xl flex items-center gap-2 transition-all bg-gray-50/30 font-bold text-sm ${isOpen ? 'border-primary border-b-0 rounded-b-none' : 'border-gray-100'
                            }`}
                        style={{ minWidth: '100px' }}
                    >
                        {selectedCountry ? (
                            <>
                                <img src={selectedCountry.flag} alt="" className="w-5 h-3.5 object-cover rounded-[2px]" />
                                <span>{selectedCountry.dialCode}</span>
                            </>
                        ) : '...'}
                        <span className="material-symbols-outlined text-gray-400 text-sm">expand_more</span>
                    </button>

                    {isOpen && (
                        <div className="absolute top-full left-0 w-64 bg-white border-2 border-primary border-t-0 rounded-b-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                            <div className="p-2 border-b border-gray-100">
                                <input
                                    type="text"
                                    placeholder={t('search_country')}
                                    className="w-full p-2 text-xs border border-gray-100 rounded-lg outline-none focus:border-primary"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                {filteredCountries.map((country) => (
                                    <button
                                        key={country.code}
                                        type="button"
                                        onClick={() => handleCountrySelect(country)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <img src={country.flag} alt="" className="w-6 h-4 object-cover rounded-[2px]" />
                                        <div className="flex-grow">
                                            <p className="text-[10px] font-black text-gray-900 leading-none mb-1">
                                                {country.code === 'BR' ? 'Brasil' : country.name}
                                            </p>
                                            <p className="text-xs font-bold text-primary">{country.dialCode}</p>
                                        </div>
                                    </button>
                                ))}
                                {filteredCountries.length === 0 && (
                                    <div className="p-4 text-center text-xs text-gray-400 font-bold">
                                        {t('no_country_found')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Number Input */}
                <div className="flex-grow">
                    <input
                        type="tel"
                        value={value}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder={
                            selectedCountry?.dialCode === '+55' ? '(00) 00000-0000' :
                                selectedCountry?.dialCode === '+1' ? '(000) 000-0000' :
                                    '0000000000'
                        }
                        required={required}
                        className={`w-full border-2 rounded-2xl p-4 text-sm font-bold transition-all outline-none 
                            ${error
                                ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-200'
                                : 'border-gray-100 bg-gray-50/30 text-gray-900 focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white'
                            }`}
                    />
                </div>
            </div>

            {error && (
                <p className="text-[10px] text-red-500 font-bold ml-1">{error}</p>
            )}
        </div>
    );
};
