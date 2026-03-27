import type { ModelPickerProps } from '@/web/components/modelSelection/modelPicker.types';
import { buildModelPickerReadModel } from '@/web/components/modelSelection/modelPickerReadModel';
import { ModelPickerPopoverView } from '@/web/components/modelSelection/modelPickerPopoverView';
import { ModelPickerSelectView } from '@/web/components/modelSelection/modelPickerSelectView';
import { shouldUsePopoverModelPicker } from '@/web/components/modelSelection/shouldUsePopoverModelPicker';
import { useModelPickerPopoverController } from '@/web/components/modelSelection/useModelPickerPopoverController';

export type { ModelPickerProps } from '@/web/components/modelSelection/modelPicker.types';
export {
    buildModelPickerReadModel,
    getModelLabelCollisionIndex,
    getOptionDisplayText,
} from '@/web/components/modelSelection/modelPickerReadModel';
export { shouldUsePopoverModelPicker } from '@/web/components/modelSelection/shouldUsePopoverModelPicker';

function PopoverModelPicker(props: ModelPickerProps) {
    const controller = useModelPickerPopoverController(props.disabled !== undefined ? { disabled: props.disabled } : {});
    const readModel = buildModelPickerReadModel({
        models: props.models,
        selectedModelId: props.selectedModelId,
    });

    return <ModelPickerPopoverView {...props} controller={controller} readModel={readModel} />;
}

export function ModelPicker(props: ModelPickerProps) {
    if (shouldUsePopoverModelPicker({ providerId: props.providerId, models: props.models })) {
        return <PopoverModelPicker {...props} />;
    }

    return (
        <ModelPickerSelectView
            {...props}
            readModel={buildModelPickerReadModel({
                models: props.models,
                selectedModelId: props.selectedModelId,
            })}
        />
    );
}
