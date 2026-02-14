'use client';

import { useEffect, useState } from 'react';

export function useAbVariant(experimentKey: string, variants: string[] = ['A', 'B']) {
    const [variant, setVariant] = useState<string>(variants[0]);
    const variantsKey = variants.join('|');

    useEffect(() => {
        const storageKey = `ab:${experimentKey}`;
        const saved = localStorage.getItem(storageKey);
        if (saved && variants.includes(saved)) {
            setVariant(saved);
            return;
        }
        const selected = variants[Math.floor(Math.random() * variants.length)];
        localStorage.setItem(storageKey, selected);
        setVariant(selected);
    }, [experimentKey, variantsKey]);

    return variant;
}
