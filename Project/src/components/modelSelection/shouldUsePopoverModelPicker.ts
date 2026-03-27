import type { ModelPickerProps } from '@/web/components/modelSelection/modelPicker.types';

export function shouldUsePopoverModelPicker(props: Pick<ModelPickerProps, 'providerId' | 'models'>): boolean {
    if (
        props.models.some((option) => option.capabilityBadges.length > 0 || option.compatibilityState !== 'compatible')
    ) {
        return true;
    }

    if (props.providerId === 'kilo') {
        return true;
    }

    const providerIds = new Set(
        props.models
            .map((option) => option.providerId)
            .filter(
                (providerId): providerId is NonNullable<(typeof props.models)[number]['providerId']> =>
                    typeof providerId === 'string'
            )
    );
    return providerIds.size > 1;
}
