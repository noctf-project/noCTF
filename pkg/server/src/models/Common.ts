export type UnixTimestamp = number;

export type IndexedObject = {
    id: number;
}

export type CreationTrackedObject = {
    created_at: UnixTimestamp;
};

export type ModificationTrackedObject = {
    modified_at: UnixTimestamp;
};

export type UpsertTrackedObject = CreationTrackedObject & ModificationTrackedObject;
