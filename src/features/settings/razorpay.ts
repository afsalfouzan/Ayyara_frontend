import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type RazorpaySettings = {
  source: 'env' | 'database' | null;
  editable: boolean;
  connected: boolean;
  keyId: string | null;
  keySecretLast4: string | null;
  webhookSecretLast4: string | null;
  mode: 'test' | 'live' | null;
  updatedAt: string | null;
  updatedBy: string | null;
  webhookUrl: string;
  webhookEvents: string[];
  encryptionAvailable: boolean;
  loadError: string | null;
};

const KEY = ['settings', 'razorpay'] as const;

export function useRazorpaySettings(enabled = true) {
  return useQuery({ queryKey: KEY, queryFn: () => api<{ razorpay: RazorpaySettings }>('/admin/settings/razorpay').then((d) => d.razorpay), enabled });
}

function useApply() {
  const queryClient = useQueryClient();
  return (data: { razorpay: RazorpaySettings }) => {
    queryClient.setQueryData(KEY, data.razorpay);
    void queryClient.invalidateQueries({ queryKey: ['payments'] });
  };
}

export function useSaveRazorpay() {
  const apply = useApply();
  return useMutation({
    mutationFn: (input: { keyId: string; keySecret?: string; webhookSecret?: string }) => api<{ razorpay: RazorpaySettings }>('/admin/settings/razorpay', { method: 'PUT', body: input }),
    onSuccess: apply,
  });
}

export function useRemoveRazorpay() {
  const apply = useApply();
  return useMutation({ mutationFn: () => api<{ razorpay: RazorpaySettings }>('/admin/settings/razorpay', { method: 'DELETE' }), onSuccess: apply });
}
