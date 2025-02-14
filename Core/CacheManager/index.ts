/**
 * @class CacheController
 * @description Cache Controller for storing and retrieving data in-memory.
 */
export default class CacheController {
  private cache: Map<string, { data: any; ttl: number }>;

  constructor() {
    this.cache = new Map();
    this.startExpirationCheck();
  }

  public updateAllOccurrences(collection: string, payload: { id: string; fields: any }) {
    const keys = this.keys();
  
    for (const key of keys) {
      let cacheData = this.get(key);
  
      // Handle arrays in _payload
      if (Array.isArray(cacheData?._payload)) {
        const exists = cacheData._payload.some((item: any) => item.id === payload.id);
        if (exists) {
          cacheData._payload = cacheData._payload.map((item: any) =>
            item.id === payload.id ? { ...item, ...payload.fields } : item
          );
          this.set(key, cacheData, 60000); // Update cache with expanded fields
        }
      }
      // Handle objects with _payload
      else if (typeof cacheData === "object" && cacheData !== null) {
        if ("_payload" in cacheData && cacheData._payload.id === payload.id) {
          cacheData._payload = { ...cacheData._payload, ...payload.fields };
          this.set(key, cacheData, 60000); // Update cache with expanded fields
        } else {
          // General object update
          cacheData = this.recursivelyUpdate(cacheData, payload.id, payload.fields);
          this.set(key, cacheData, 60000); // Update cache with expanded fields
        }
      }
    }
  }
  
  /**
   * Recursively updates occurrences of `id` within a data structure.
   */
  private recursivelyUpdate(data: any, id: string, fields: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.recursivelyUpdate(item, id, fields));
    } else if (typeof data === "object" && data !== null) {
      if (data.id === id) {
        return { ...data, ...fields };
      }
      const updatedObject = { ...data };
      for (const key in updatedObject) {
        updatedObject[key] = this.recursivelyUpdate(updatedObject[key], id, fields);
      }
      return updatedObject;
    }
    return data;
  }
  

  public set(key: string, data: any, ttl: number = 0): any {
    key = this.sanitizeKey(key);
    const expiry = ttl > 0 ? Date.now() + ttl : 0;
    this.cache.set(key, { data, ttl: expiry });
    return data;
  }

  public updateCache(updatedItem: any) {
    const keys = this.keys();
    for (const key of keys) {
      let cacheEntry = this.get(key);
      if (Array.isArray(cacheEntry)) {
        let index = cacheEntry.findIndex((item: any) => item.id === updatedItem.id);
        if (index > -1) {
          cacheEntry[index] = updatedItem;
          this.set(key, cacheEntry);
        }
      } else if (cacheEntry.id === updatedItem.id) {
        this.delete(key);
      }
    }
  }

  public delete(key: string): boolean {
    key = this.sanitizeKey(key);
    return this.cache.delete(key);
  }

  public get(key: string): any {
    key = this.sanitizeKey(key);
    const cacheEntry = this.cache.get(key);
    if (!cacheEntry) return null;

    const now = Date.now();
    if (cacheEntry.ttl > 0 && cacheEntry.ttl < now) {
      this.cache.delete(key);
      return null;
    }

    return cacheEntry.data;
  }

  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  private sanitizeKey(key: string): string {
    return key.toString().replace(/[^a-zA-Z0-9]/g, "");
  }

  private startExpirationCheck(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, { ttl }] of this.cache.entries()) {
        if (ttl > 0 && ttl < now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Check every minute
  }
}
