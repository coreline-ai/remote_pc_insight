import { AiProvider } from './api';

export const AI_PROVIDER_STORAGE_KEY = 'pcinsight-ai-provider';
export const AI_PROVIDER_CHANGED_EVENT = 'pcinsight-ai-provider-changed';

export function getEnvDefaultAiProvider(): AiProvider {
    return process.env.NEXT_PUBLIC_AI_PROVIDER === 'glm45' ? 'glm45' : 'openai';
}

export function loadAiProviderPreference(): AiProvider {
    const envDefault = getEnvDefaultAiProvider();
    if (typeof window === 'undefined') return envDefault;
    const saved = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    return saved === 'glm45' || saved === 'openai' ? saved : envDefault;
}

export function saveAiProviderPreference(provider: AiProvider): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider);
    window.dispatchEvent(
        new CustomEvent(AI_PROVIDER_CHANGED_EVENT, {
            detail: { provider },
        })
    );
}

