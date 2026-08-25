export interface Bucket {
  name: string;
}

export interface StorageFolderEntry {
  type: "folder";
  prefix: string;
}

export interface StorageObjectEntry {
  type: "object";
  key: string;
  size: number;
  lastModified: string;
}

export type StorageEntry = StorageFolderEntry | StorageObjectEntry;
