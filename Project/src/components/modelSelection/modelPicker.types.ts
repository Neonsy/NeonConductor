import type { ModelPickerOption } from '@/web/components/modelSelection/modelCapabilities';

import type { RuntimeProviderId } from '@/shared/contracts';

export interface ModelPickerProps {
    providerId: RuntimeProviderId | undefined;
    selectedModelId: string;
    models: ModelPickerOption[];
    disabled?: boolean;
    id?: string;
    name?: string;
    ariaLabel: string;
    placeholder: string;
    onSelectModel: (modelId: string) => void;
    onSelectOption?: (option: ModelPickerOption) => void;
}

export interface ModelGroupViewModel {
    key: string;
    label: string;
    options: ModelOptionViewModel[];
}

export interface PopoverLayout {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
}

export type ModelLabelCollisionIndex = ReadonlyMap<string, number>;

export interface ModelOptionViewModel {
    key: string;
    option: ModelPickerOption;
    displayText: string;
    description: string;
    metricBadges: string[];
    sourceProviderBadge: string | undefined;
    capabilityBadges: string[];
    selected: boolean;
}

export interface ModelPickerReadModel {
    selectedOption: ModelPickerOption | undefined;
    labelCollisionIndex: ModelLabelCollisionIndex;
    groups: Array<{
        key: string;
        label: string;
        options: ModelOptionViewModel[];
    }>;
    options: ModelOptionViewModel[];
}
