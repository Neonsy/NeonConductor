export type ToolArtifactKind = 'command_output' | 'file_read' | 'directory_listing';
export type ToolArtifactPreviewStrategy = 'head_tail' | 'head_only' | 'bounded_list';

const byteFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
});

export function formatToolArtifactBytes(totalBytes: number): string {
    if (totalBytes < 1024) {
        return `${String(totalBytes)} B`;
    }
    if (totalBytes < 1024 * 1024) {
        return `${byteFormatter.format(totalBytes / 1024)} KB`;
    }

    return `${byteFormatter.format(totalBytes / (1024 * 1024))} MB`;
}

export function formatToolArtifactKindLabel(artifactKind: ToolArtifactKind): string {
    if (artifactKind === 'command_output') {
        return 'Command output';
    }
    if (artifactKind === 'file_read') {
        return 'File read';
    }

    return 'Directory listing';
}
