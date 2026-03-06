import { getPersistence } from '@/app/backend/persistence/db';
import { isJsonRecord, parseJsonValue } from '@/app/backend/persistence/stores/utils';
import type { MarketplacePackageRecord } from '@/app/backend/persistence/types';

export class MarketplaceStore {
    async listPackages(): Promise<MarketplacePackageRecord[]> {
        const { db } = getPersistence();
        const [packageRows, assetRows] = await Promise.all([
            db
                .selectFrom('marketplace_packages')
                .select([
                    'id',
                    'package_kind',
                    'slug',
                    'version',
                    'enabled',
                    'pinned',
                    'source_json',
                    'installed_at',
                    'updated_at',
                ])
                .orderBy('slug', 'asc')
                .execute(),
            db
                .selectFrom('marketplace_assets')
                .select(['package_id', 'asset_kind', 'asset_id', 'created_at'])
                .orderBy('package_id', 'asc')
                .orderBy('asset_kind', 'asc')
                .orderBy('asset_id', 'asc')
                .execute(),
        ]);

        const assetsByPackageId = new Map<string, MarketplacePackageRecord['assets']>();
        for (const assetRow of assetRows) {
            const bucket = assetsByPackageId.get(assetRow.package_id) ?? [];
            bucket.push({
                assetKind: assetRow.asset_kind,
                assetId: assetRow.asset_id,
                createdAt: assetRow.created_at,
            });
            assetsByPackageId.set(assetRow.package_id, bucket);
        }

        return packageRows.map((packageRow) => ({
            id: packageRow.id,
            packageKind: packageRow.package_kind,
            slug: packageRow.slug,
            version: packageRow.version,
            enabled: packageRow.enabled === 1,
            pinned: packageRow.pinned === 1,
            source: parseJsonValue(packageRow.source_json, {}, isJsonRecord),
            installedAt: packageRow.installed_at,
            updatedAt: packageRow.updated_at,
            assets: assetsByPackageId.get(packageRow.id) ?? [],
        }));
    }
}

export const marketplaceStore = new MarketplaceStore();
