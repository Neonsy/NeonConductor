import { Button } from '@/web/components/ui/button';
import {
    formatToolArtifactBytes,
    formatToolArtifactKindLabel,
    type ToolArtifactKind,
} from '@/web/components/conversation/messages/toolArtifactFormatting';

interface ToolArtifactPreviewCardProps {
    artifactKind: ToolArtifactKind;
    totalBytes?: number;
    totalLines?: number;
    omittedBytes?: number;
    summaryMode?: 'deterministic' | 'utility_ai';
    onOpen: () => void;
}

function buildMetadataSummary(input: {
    artifactKind: ToolArtifactKind;
    totalBytes?: number;
    totalLines?: number;
    omittedBytes?: number;
}): string {
    const detailParts = [formatToolArtifactKindLabel(input.artifactKind)];

    if (input.totalBytes !== undefined) {
        detailParts.push(formatToolArtifactBytes(input.totalBytes));
    }
    if (input.totalLines !== undefined) {
        detailParts.push(`${String(input.totalLines)} lines`);
    }

    const summary = detailParts.join(' · ');
    if (input.omittedBytes === undefined || input.omittedBytes <= 0) {
        return `${summary}. Full output stored separately.`;
    }

    return `${summary}. ${formatToolArtifactBytes(input.omittedBytes)} hidden from prompt context.`;
}

export function ToolArtifactPreviewCard({
    artifactKind,
    totalBytes,
    totalLines,
    omittedBytes,
    summaryMode,
    onOpen,
}: ToolArtifactPreviewCardProps) {
    return (
        <div className='border-border/70 bg-background/60 rounded-2xl border px-4 py-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='space-y-1'>
                    {summaryMode === 'utility_ai' ? (
                        <p className='text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase'>
                            AI summary
                        </p>
                    ) : null}
                    <p className='text-foreground text-sm font-medium'>Stored full output available</p>
                    <p className='text-muted-foreground text-xs'>
                        {buildMetadataSummary({
                            artifactKind,
                            ...(totalBytes !== undefined ? { totalBytes } : {}),
                            ...(totalLines !== undefined ? { totalLines } : {}),
                            ...(omittedBytes !== undefined ? { omittedBytes } : {}),
                        })}
                    </p>
                </div>
                <Button type='button' size='sm' variant='outline' onClick={onOpen}>
                    Open full output
                </Button>
            </div>
        </div>
    );
}
