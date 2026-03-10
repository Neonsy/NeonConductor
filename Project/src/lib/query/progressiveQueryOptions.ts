import { keepPreviousData } from '@tanstack/react-query';

export const PROGRESSIVE_QUERY_OPTIONS = {
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
} as const;
