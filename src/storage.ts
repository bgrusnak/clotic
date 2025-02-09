// src/storage.ts
// This file provides the StorageHelper class, which encapsulates operations for interacting with the R2 storage using the R2Bucket API.

export class StorageHelper {
    private bucket: R2Bucket;
  
    /**
     * Constructs a new StorageHelper instance.
     * @param bucket - The R2Bucket instance to interact with the R2 storage.
     */
    constructor(bucket: R2Bucket) {
      this.bucket = bucket;
    }
  
    /**
     * Saves a file into the R2 storage using the provided key.
     * The file can be either a Blob or an ArrayBuffer.
     * @param key - The key under which the file will be stored.
     * @param file - The file data as a Blob or ArrayBuffer.
     */
    async putFile(key: string, file: Blob | ArrayBuffer): Promise<void> {
      if (file instanceof ArrayBuffer) {
        await this.bucket.put(key, new Uint8Array(file));
      } else {
        await this.bucket.put(key, file);
      }
    }
  
    /**
     * Retrieves a file from the R2 storage using the provided key.
     * @param key - The key under which the file is stored.
     * @returns A Blob containing the file data if found, or null if the file does not exist.
     */
    async getFile(key: string): Promise<Blob | null> {
      const object = await this.bucket.get(key);
      if (!object) {
        return null;
      }
      return await object.blob();
    }
  }
  