export function readRelatedTargetNode(value: unknown): Node | null {
    return value instanceof Node ? value : null;
}
