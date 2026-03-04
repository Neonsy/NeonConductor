import type { ProfileInput } from '@/app/backend/runtime/contracts/types';
import { createParser, readObject, readProfileId } from '@/app/backend/runtime/contracts/parsers/helpers';

export function parseProfileInput(input: unknown): ProfileInput {
    const source = readObject(input, 'input');
    return {
        profileId: readProfileId(source),
    };
}

export const profileInputSchema = createParser(parseProfileInput);
