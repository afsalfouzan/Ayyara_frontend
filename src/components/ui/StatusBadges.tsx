import { Badge } from './Badge';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export function StockBadge({ status }: { status: StockStatus }) {
  if (status === 'in_stock') return null;
  return <Badge tone={status === 'low_stock' ? 'warning' : 'danger'}>{status === 'low_stock' ? 'Low' : 'Out of stock'}</Badge>;
}
