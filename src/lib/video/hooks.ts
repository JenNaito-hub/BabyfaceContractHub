"use client";

import { useCallback, useEffect, useState } from "react";
import { importFile, listAssets } from "./db";
import type { Asset } from "./types";

/** Nạp danh sách asset từ IndexedDB + xử lý upload nhiều file. */
export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setAssets(await listAssets());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được thư viện");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upload = useCallback(
    async (files: FileList | File[]): Promise<Asset[]> => {
      const list = Array.from(files);
      if (list.length === 0) return [];
      setBusy(true);
      const added: Asset[] = [];
      const failed: string[] = [];
      for (const file of list) {
        try {
          added.push(await importFile(file));
        } catch {
          failed.push(file.name);
        }
      }
      await reload();
      setBusy(false);
      setError(failed.length ? `Bỏ qua ${failed.length} file lỗi: ${failed.join(", ")}` : null);
      return added;
    },
    [reload],
  );

  return { assets, loading, busy, error, reload, upload };
}

/** Nạp 1 collection doc bất kỳ (project/talent/production/script). */
export function useCollection<T extends { id: string }>(store: {
  list: () => Promise<T[]>;
  put: (doc: T) => Promise<T>;
  remove: (id: string) => Promise<void>;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setItems(await store.list());
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (doc: T) => {
      await store.put(doc);
      await reload();
    },
    [store, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await store.remove(id);
      await reload();
    },
    [store, reload],
  );

  return { items, loading, reload, save, remove };
}
