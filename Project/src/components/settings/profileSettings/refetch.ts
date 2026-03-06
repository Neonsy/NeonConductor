interface Refetchable {
    refetch: () => Promise<unknown>;
}

export async function refetchProfileList(query: Refetchable): Promise<void> {
    await query.refetch();
}

export function refetchProfilePreference(query: Refetchable): void {
    void query.refetch();
}
