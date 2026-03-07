import { describe, expect, it } from 'vitest';

import { runtimeSqlMigrations } from '@/app/backend/persistence/generatedMigrations';

describe('generated migrations', () => {
    it('includes ordered sql migrations used by runtime', () => {
        const names = runtimeSqlMigrations.map((migration) => migration.name);
        expect(names).toEqual(['001_runtime_baseline_v4.sql', '002_kilo_account_balance.sql']);
    });
});
