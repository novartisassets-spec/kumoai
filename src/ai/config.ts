import { ENV } from '../config/env';
import { ModelConfig } from './provider';

// PA Agent: Groq -> Gemini -> OpenRouter
export const PA_CONFIG: ModelConfig = {
    provider: 'groq',
    model: ENV.GROQ_MODEL,
    apiKey: ENV.PA_GROQ_API_KEY,
    fallback: {
        provider: 'gemini',
        model: ENV.GEMINI_MODEL,
        apiKey: ENV.PA_GEMINI_API_KEY,
        fallback: {
            provider: 'openrouter',
            model: ENV.OPENROUTER_MODEL,
            apiKey: ENV.PA_OPENROUTER_API_KEY
        }
    }
};

// TA Agent: Groq -> Gemini -> OpenRouter (Secondary schools)
export const TA_CONFIG: ModelConfig = {
    provider: 'groq',
    model: ENV.GROQ_MODEL,
    apiKey: ENV.TA_GROQ_API_KEY,
    fallback: {
        provider: 'gemini',
        model: ENV.GEMINI_MODEL,
        apiKey: ENV.TA_GEMINI_API_KEY,
        fallback: {
            provider: 'openrouter',
            model: ENV.OPENROUTER_MODEL,
            apiKey: ENV.TA_OPENROUTER_API_KEY
        }
    }
};

// PRIMARY_TA Agent: Groq -> Gemini -> OpenRouter (Primary schools)
export const PRIMARY_TA_CONFIG: ModelConfig = {
    provider: 'groq',
    model: ENV.GROQ_MODEL,
    apiKey: ENV.PRIMARY_TA_GROQ_API_KEY,
    fallback: {
        provider: 'gemini',
        model: ENV.GEMINI_MODEL,
        apiKey: ENV.PRIMARY_TA_GEMINI_API_KEY,
        fallback: {
            provider: 'openrouter',
            model: ENV.OPENROUTER_MODEL,
            apiKey: ENV.PRIMARY_TA_OPENROUTER_API_KEY
        }
    }
};

// SA Agent: Groq -> Gemini -> OpenRouter
export const SA_CONFIG: ModelConfig = {
    provider: 'groq',
    model: ENV.GROQ_MODEL,
    apiKey: ENV.SA_GROQ_API_KEY,
    fallback: {
        provider: 'gemini',
        model: ENV.GEMINI_MODEL,
        apiKey: ENV.SA_GEMINI_API_KEY,
        fallback: {
            provider: 'openrouter',
            model: ENV.OPENROUTER_MODEL,
            apiKey: ENV.SA_OPENROUTER_API_KEY
        }
    }
};

// GA Agent: Groq -> Gemini -> OpenRouter
export const GA_CONFIG: ModelConfig = {
    provider: 'groq',
    model: ENV.GROQ_MODEL,
    apiKey: ENV.GA_GROQ_API_KEY,
    fallback: {
        provider: 'gemini',
        model: ENV.GEMINI_MODEL,
        apiKey: ENV.GA_GEMINI_API_KEY,
        fallback: {
            provider: 'openrouter',
            model: ENV.OPENROUTER_MODEL,
            apiKey: ENV.GA_OPENROUTER_API_KEY
        }
    }
};

// Migration helper for existing code using SA_TA_CONFIG
export const SA_TA_CONFIG = SA_CONFIG;