import { errOp, okOp, type OperationalResult } from '@/app/backend/runtime/services/common/operationalError';

export function parseThreadTitle(input: string): OperationalResult<string> {
    const title = input.trim();
    if (title.length === 0) {
        return errOp('invalid_input', 'Thread title must be a non-empty string.');
    }

    return okOp(title);
}
