import {
    AI_PROVIDER_CHANGED_EVENT,
    AI_PROVIDER_STORAGE_KEY,
    getEnvDefaultAiProvider,
    loadAiProviderPreference,
    saveAiProviderPreference,
} from '../lib/ai-provider';

describe('ai-provider preference', () => {
    beforeEach(() => {
        window.localStorage.clear();
        process.env.NEXT_PUBLIC_AI_PROVIDER = 'glm45';
    });

    it('returns env default when no saved value exists', () => {
        expect(getEnvDefaultAiProvider()).toBe('glm45');
        expect(loadAiProviderPreference()).toBe('glm45');
    });

    it('loads saved provider from localStorage', () => {
        window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, 'openai');
        expect(loadAiProviderPreference()).toBe('openai');
    });

    it('saves provider and emits changed event', () => {
        const listener = jest.fn();
        window.addEventListener(AI_PROVIDER_CHANGED_EVENT, listener);

        saveAiProviderPreference('openai');

        expect(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY)).toBe('openai');
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(AI_PROVIDER_CHANGED_EVENT, listener);
    });
});

