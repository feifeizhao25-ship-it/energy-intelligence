'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationSuggestion {
    name: string;
    address: string;
    province: string;
    city: string;
    district: string;
    location: { lat: number; lng: number };
}

interface AddressAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onSelect?: (suggestion: LocationSuggestion) => void;
    placeholder?: string;
    className?: string;
}

export default function AddressAutocomplete({
    value,
    onChange,
    onSelect,
    placeholder = '输入地址或地点名称...',
    className
}: AddressAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // 获取地址建议
    const fetchSuggestions = async (query: string) => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/location/suggestions?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.success && data.data) {
                setSuggestions(data.data.slice(0, 8));
            }
        } catch (error) {
            console.error('Failed to fetch suggestions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Debounced input handler
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);
        setShowDropdown(true);
        setSelectedIndex(-1);

        // Debounce API calls
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(newValue);
        }, 300);
    };

    // Handle suggestion selection
    const handleSelect = (suggestion: LocationSuggestion) => {
        const displayValue = suggestion.name || suggestion.address;
        onChange(displayValue);
        setShowDropdown(false);
        setSuggestions([]);
        onSelect?.(suggestion);
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0) {
                    handleSelect(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowDropdown(false);
                break;
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative">
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => value.length >= 2 && setShowDropdown(true)}
                    placeholder={placeholder}
                    className={cn(
                        "w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-slate-900 placeholder:text-slate-400",
                        className
                    )}
                />
                {isLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
                )}
                {!isLoading && value && (
                    <button
                        onClick={() => {
                            onChange('');
                            setSuggestions([]);
                            inputRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {showDropdown && suggestions.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                >
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelect(suggestion)}
                            className={cn(
                                "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors",
                                index === selectedIndex && "bg-green-50"
                            )}
                        >
                            <MapPin className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 truncate">
                                    {suggestion.name}
                                </div>
                                <div className="text-sm text-slate-500 truncate">
                                    {suggestion.province}{suggestion.city && ` · ${suggestion.city}`}
                                    {suggestion.district && ` · ${suggestion.district}`}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* No results message */}
            {showDropdown && !isLoading && value.length >= 2 && suggestions.length === 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-center text-slate-500 text-sm"
                >
                    未找到匹配的地址，请尝试输入更详细的地点名称
                </div>
            )}
        </div>
    );
}
