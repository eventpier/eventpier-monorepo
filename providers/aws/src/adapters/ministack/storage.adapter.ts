import {
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Bucket, Page, StorageEntry } from "@eventpier/contracts";

const REGION = "us-east-1";
const CREDENTIALS = { accessKeyId: "test", secretAccessKey: "test" };
const DELIMITER = "/";
const REQUEST_TIMEOUT_MS = 3000;

export interface StorageAdapter {
  listBuckets(cursor?: string): Promise<Page<Bucket>>;
  listObjects(bucket: string, prefix?: string, cursor?: string): Promise<Page<StorageEntry>>;
}

export function createMiniStackStorageAdapter(endpoint: string): StorageAdapter {
  const client = new S3Client({
    region: REGION,
    endpoint,
    forcePathStyle: true,
    credentials: CREDENTIALS,
    requestHandler: {
      requestTimeout: REQUEST_TIMEOUT_MS,
      connectionTimeout: REQUEST_TIMEOUT_MS,
    },
  });

  return {
    async listBuckets(cursor) {
      const result = await client.send(
        new ListBucketsCommand({ ContinuationToken: cursor }),
      );
      return {
        items: (result.Buckets ?? [])
          .filter((b) => b.Name !== undefined)
          .map((b) => ({ name: b.Name! })),
        nextCursor: result.ContinuationToken,
      };
    },

    async listObjects(bucket, prefix, cursor) {
      const result = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: DELIMITER,
          ContinuationToken: cursor,
        }),
      );

      const folders: StorageEntry[] = (result.CommonPrefixes ?? [])
        .filter((p) => p.Prefix !== undefined)
        .map((p) => ({ type: "folder", prefix: p.Prefix! }));

      // Só um prefix terminado em delimiter pode corresponder ao marcador de
      // pasta de zero bytes; um prefix "solto" coincidindo com uma key real
      // não deve esconder esse objeto do resultado.
      const isFolderMarker = (key: string) =>
        prefix !== undefined && prefix.endsWith(DELIMITER) && key === prefix;

      const objects: StorageEntry[] = (result.Contents ?? [])
        .filter((o) => o.Key !== undefined && !isFolderMarker(o.Key))
        .map((o) => ({
          type: "object",
          key: o.Key!,
          size: o.Size ?? 0,
          lastModified: o.LastModified?.toISOString() ?? new Date(0).toISOString(),
        }));

      return {
        items: [...folders, ...objects],
        nextCursor: result.NextContinuationToken,
      };
    },
  };
}
