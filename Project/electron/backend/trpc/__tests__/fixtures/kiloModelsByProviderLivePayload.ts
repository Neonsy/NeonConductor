export const kiloModelsByProviderLivePayload = {
    providers: [
        {
            provider: 'openai',
            displayName: 'OpenAI',
            models: [
                {
                    endpoint: {
                        model: {
                            id: 'openai/gpt-5',
                            context_length: 128000,
                            max_completion_tokens: 4096,
                        },
                    },
                    pricing: {
                        prompt: '0.000001',
                        completion: '0.000003',
                        cache_read: '0.0000002',
                        cache_write: '0.0000005',
                    },
                },
            ],
        },
    ],
} as const;
