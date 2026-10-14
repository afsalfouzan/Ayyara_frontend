import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StockStatus } from '@/components/ui/StatusBadges';

export type Photo = { id: number; url: string; alt: string; width: number; height: number; sortOrder: number };

export type Variant = {
  id: number;
  sizeMl: number;
  mrpPaise: number;
  pricePaise: number;
  lowStockThreshold: number;
  maxPerOrder: number;
  stock: { onHand: number; reserved: number; available: number; status: StockStatus };
};

export type Gender = 'men' | 'women' | 'unisex';
export const GENDER_LABEL: Record<Gender, string> = { men: 'Men', women: 'Women', unisex: 'Unisex' };

/** Allowed values for the fragrance profile; kept in step with the backend's modules/stock/fragrance-profile.ts. */
export const CONCENTRATIONS = ['Extrait de Parfum', 'Parfum', 'Eau de Parfum', 'Eau de Toilette', 'Eau de Cologne'] as const;
export const FRAGRANCE_FAMILIES = ['Floral', 'Fruity', 'Fresh', 'Citrus', 'Aquatic', 'Green', 'Aromatic', 'Fougère', 'Chypre', 'Woody', 'Amber', 'Spicy', 'Gourmand', 'Leather', 'Oud'] as const;
export const PROJECTION_LABEL = { soft: 'Soft: stays close to the skin', moderate: 'Moderate: noticed within arm’s length', strong: 'Strong: fills the space around you' } as const;
export const SEASON_LABEL = { summer: 'Summer', monsoon: 'Monsoon', winter: 'Winter' } as const;
export const OCCASION_LABEL = { daytime: 'Daytime', office: 'Office', casual: 'Casual', evening: 'Evening', 'date night': 'Date night', 'special occasions': 'Special occasions' } as const;

export type Projection = keyof typeof PROJECTION_LABEL;
export type Season = keyof typeof SEASON_LABEL;
export type Occasion = keyof typeof OCCASION_LABEL;

export type FragranceProfile = {
  fragranceFamily: string | null;
  longevityHours: { min: number; max: number } | null;
  projection: Projection | null;
  seasons: Season[];
  occasions: Occasion[];
  similarScents: string | null;
  keyIngredients: string[];
  allergens: string | null;
  perfumer: string | null;
  launchYear: number | null;
};

export type Notes = { top: string[]; heart: string[]; base: string[] };

export type ProfileInput = Omit<FragranceProfile, 'fragranceFamily'> & { concentration: string; notes: Notes; fragranceFamily: string | null };

export type Perfume = {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: 'active' | 'hidden';
  gender: Gender;
  concentration: string;
  notes: Notes;
  profile: FragranceProfile;
  images: Photo[];
  variants: Variant[];
  totalOnHand: number;
  updatedAt: string;
};

export type StockOverview = {
  items: Perfume[];
  summary: { perfumes: number; totalOnHand: number; lowStock: number; outOfStock: number };
  adjustmentReasons: Record<string, string>;
};

export type PurchaseLine = { id: number; variantId: number; productName: string; sizeMl: number; quantity: number; unitCostPaise?: number | null; lineCostPaise?: number | null };
export type Purchase = { id: number; purchaseDate: string; note: string | null; createdBy: string | null; createdAt: string; items: PurchaseLine[]; totalQuantity: number; totalCostPaise?: number | null };

export type PurchaseItemInput = {
  productId?: number;
  newProduct?: { name: string; description: string };
  sizeMl: number;
  quantity: number;
  mrpPaise?: number;
  pricePaise?: number;
  /** What the bottles cost: per bottle, or for the whole line. Exactly one is sent. */
  unitCostPaise?: number;
  totalCostPaise?: number;
};

export type HistoryEntry = { id: number; type: 'purchase' | 'sale' | 'return' | 'adjustment' | 'cancellation'; quantity: number; balanceAfter: number; reason: string | null; createdBy: string | null; createdAt: string };

const KEY = ['stock'] as const;

export function useStock() {
  return useQuery({ queryKey: KEY, queryFn: () => api<StockOverview>('/admin/stock') });
}

export function usePerfume(id: number | null) {
  return useQuery({
    queryKey: [...KEY, 'perfume', id],
    queryFn: () => api<{ perfume: Perfume }>(`/admin/stock/products/${id}`).then((d) => d.perfume),
    enabled: id != null,
  });
}

/** Mutations return the fresh overview; write it straight into the cache. */
function useRefresh() {
  const queryClient = useQueryClient();
  return (overview?: Partial<StockOverview>) => {
    if (overview?.items) queryClient.setQueryData(KEY, (current: StockOverview | undefined) => ({ ...current!, ...overview }));
    void queryClient.invalidateQueries({ queryKey: KEY });
  };
}

export function useAddPurchase() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { requestId: string; purchaseDate: string; note: string | null; items: PurchaseItemInput[] }) =>
      api<{ purchase: Purchase } & StockOverview>('/admin/stock/purchases', { method: 'POST', body: input }),
    onSuccess: (data) => refresh(data),
  });
}

export function useSavePerfume(id: number) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { name: string; description: string; status: 'active' | 'hidden'; gender: Gender; variants: { id?: number; sizeMl: number; mrpPaise: number; pricePaise: number; lowStockThreshold: number }[] }) =>
      api<{ perfume: Perfume }>(`/admin/stock/products/${id}`, { method: 'PUT', body: input }).then((d) => d.perfume),
    onSuccess: () => refresh(),
  });
}

export function useSaveProfile(id: number) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: ProfileInput) => api<{ perfume: Perfume }>(`/admin/stock/products/${id}/profile`, { method: 'PUT', body: input }).then((d) => d.perfume),
    onSuccess: () => refresh(),
  });
}

export function usePhotos(id: number) {
  const refresh = useRefresh();
  const base = `/admin/stock/products/${id}/images`;
  const done = { onSuccess: () => refresh() };
  return {
    upload: useMutation({
      mutationFn: (file: File) => {
        const form = new FormData();
        form.append('image', file);
        return api<{ perfume: Perfume }>(base, { method: 'POST', body: form });
      },
      ...done,
    }),
    reorder: useMutation({ mutationFn: (imageIds: number[]) => api<{ perfume: Perfume }>(`${base}/order`, { method: 'PUT', body: { imageIds } }), ...done }),
    remove: useMutation({ mutationFn: (imageId: number) => api<{ perfume: Perfume }>(`${base}/${imageId}`, { method: 'DELETE' }), ...done }),
  };
}

export function useCorrectStock() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { variantId: number; quantity: number; reasonCode: string; note: string; requestId: string }) =>
      api<StockOverview>('/admin/stock/adjustments', { method: 'POST', body: input }),
    onSuccess: (data) => refresh(data),
  });
}

export function useVariantHistory(variantId: number | null, page: number) {
  return useQuery({
    queryKey: [...KEY, 'history', variantId, page],
    queryFn: () => api<{ items: HistoryEntry[]; page: number; pageSize: number; total: number }>(`/admin/stock/variants/${variantId}/history?page=${page}&pageSize=20`),
    enabled: variantId != null,
    placeholderData: keepPreviousData,
  });
}

export function usePurchaseHistory(page: number, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'purchases', page],
    queryFn: () => api<{ items: Purchase[]; page: number; pageSize: number; total: number; canViewCost: boolean }>(`/admin/stock/purchases?page=${page}&pageSize=10`),
    enabled,
    placeholderData: keepPreviousData,
  });
}
