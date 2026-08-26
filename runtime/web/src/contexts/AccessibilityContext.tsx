'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type AccessibilityContextType = {
    isSeniorMode: boolean;
    toggleSeniorMode: () => void;
    fontSize: 'normal' | 'large' | 'extra-large';
    setFontSize: (size: 'normal' | 'large' | 'extra-large') => void;
    highContrast: boolean;
    toggleHighContrast: () => void;
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
    const [isSeniorMode, setIsSeniorMode] = useState(false);
    const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extra-large'>('normal');
    const [highContrast, setHighContrast] = useState(false);

    // Toggle senior mode sets a preset
    const toggleSeniorMode = () => {
        setIsSeniorMode(prev => !prev);
        if (!isSeniorMode) {
            setFontSize('large');
            setHighContrast(true);
        } else {
            setFontSize('normal');
            setHighContrast(false);
        }
    };

    const toggleHighContrast = () => setHighContrast(prev => !prev);

    // Apply classes to html/body
    useEffect(() => {
        const root = document.documentElement;

        // Font size
        root.classList.remove('text-base', 'text-lg', 'text-xl');
        if (fontSize === 'large') root.classList.add('text-lg');
        if (fontSize === 'extra-large') root.classList.add('text-xl');

        // High contrast
        if (highContrast) {
            root.classList.add('high-contrast');
        } else {
            root.classList.remove('high-contrast');
        }

    }, [fontSize, highContrast]);

    return (
        <AccessibilityContext.Provider
            value={{
                isSeniorMode,
                toggleSeniorMode,
                fontSize,
                setFontSize,
                highContrast,
                toggleHighContrast
            }}
        >
            <div className={highContrast ? 'grayscale contrast-125' : ''}>
                {children}
            </div>
        </AccessibilityContext.Provider>
    );
}

export const useAccessibility = () => {
    const context = useContext(AccessibilityContext);
    if (context === undefined) {
        throw new Error('useAccessibility must be used within an AccessibilityProvider');
    }
    return context;
};
