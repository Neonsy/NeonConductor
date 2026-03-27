import type { ModelPickerProps, ModelPickerReadModel } from '@/web/components/modelSelection/modelPicker.types';

interface ModelPickerSelectViewProps extends ModelPickerProps {
    readModel: ModelPickerReadModel;
}

export function ModelPickerSelectView(props: ModelPickerSelectViewProps) {
    return (
        <select
            {...(props.id ? { id: props.id } : {})}
            {...(props.name ? { name: props.name } : {})}
            aria-label={props.ariaLabel}
            value={props.selectedModelId}
            onChange={(event) => {
                const selectedOption = props.models.find((option) => option.id === event.target.value);
                if (selectedOption) {
                    props.onSelectOption?.(selectedOption);
                }
                props.onSelectModel(event.target.value);
            }}
            className='border-border bg-background h-10 min-w-0 rounded-xl border px-3 text-sm'
            disabled={props.disabled || props.models.length === 0}>
            {props.models.length === 0 ? (
                <option value=''>No models available</option>
            ) : (
                <>
                    <option value='' disabled>
                        {props.placeholder}
                    </option>
                    {props.readModel.options.map((modelViewModel) => (
                        <option key={modelViewModel.option.id} value={modelViewModel.option.id}>
                            {modelViewModel.displayText}
                        </option>
                    ))}
                </>
            )}
        </select>
    );
}
