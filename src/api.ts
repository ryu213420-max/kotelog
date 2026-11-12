import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type RecordType = "walk" | "meal" | "weight" | "toilet" | "health" | "diary";
export type User = { id: string; email: string; name: string; avatar: string | null };
export type Dog = {
  id: string;
  name: string;
  breed: string | null;
  sex: "male" | "female" | null;
  birthday: string | null;
  photo_key: string | null;
  created_at: string;
};
export type Rec = {
  id: string;
  dog_id: string;
  type: RecordType;
  at: string;
  value: number | null;
  tag: string | null;
  note: string | null;
  photo_key: string | null;
};
export type Stats = {
  weights: { at: string; value: number }[];
  days: { date: string; walk: number; meal: number }[];
  today: { walk: number; walkMin: number; meal: number; toilet: number };
  lastWeight: { at: string; value: number } | null;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const photoUrl = (key: string | null) => (key ? `/api/photos/${key}` : null);

/* ---------- queries ---------- */
export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/api/me"),
    retry: (n, e) => !(e instanceof ApiError && e.status === 401) && n < 2,
    staleTime: Infinity,
  });

export const useDogs = () => useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });

export const useRecords = (dogId?: string, photos = false) =>
  useQuery({
    queryKey: ["records", dogId, photos],
    queryFn: () => api<Rec[]>(`/api/dogs/${dogId}/records?limit=100${photos ? "&photos=1" : ""}`),
    enabled: !!dogId,
  });

export const useStats = (dogId?: string) =>
  useQuery({
    queryKey: ["stats", dogId],
    queryFn: () => api<Stats>(`/api/dogs/${dogId}/stats?tz=${-new Date().getTimezoneOffset()}`),
    enabled: !!dogId,
  });

/* ---------- mutations ---------- */
export function useAddRecord(dogId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: Partial<Rec>) => api<Rec>(`/api/dogs/${dogId}/records`, { method: "POST", json: r }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["records", dogId] });
      qc.invalidateQueries({ queryKey: ["stats", dogId] });
    },
  });
}

export function useDeleteRecord(dogId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/records/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      for (const photos of [false, true]) {
        qc.setQueryData<Rec[]>(["records", dogId, photos], (old) => old?.filter((r) => r.id !== id));
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["records", dogId] });
      qc.invalidateQueries({ queryKey: ["stats", dogId] });
    },
  });
}

export function useSaveDog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Partial<Dog>) =>
      d.id ? api<Dog>(`/api/dogs/${d.id}`, { method: "PATCH", json: d }) : api<Dog>("/api/dogs", { method: "POST", json: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dogs"] }),
  });
}

export function useDeleteDog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/dogs/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dogs"] }),
  });
}

/** 画像をクライアント側で縮小して WebP でアップロード */
export async function uploadPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const max = 1440;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
  if (!blob || blob.type !== "image/webp") blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("encode failed");
  const { key } = await api<{ key: string }>("/api/photos", { method: "POST", body: blob, headers: { "content-type": blob.type } });
  return key;
}
