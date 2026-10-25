import { controlClass, Select } from '@/components/ui/controls';
import { COUNTRY_CODES, type CountryCode, type WhatsAppNumber } from './whatsappNumber';

/** Country picker (UK / India) and the number box for a UK sale's WhatsApp number. */
export function WhatsAppNumberInput({ id, value, onChange }: { id: string; value: WhatsAppNumber; onChange: (next: WhatsAppNumber) => void }) {
  return (
    <div className="flex gap-2">
      <Select aria-label="Country code" className="w-32 shrink-0" value={value.code} onChange={(e) => onChange({ ...value, code: e.target.value as CountryCode })}>
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </Select>
      <input
        id={id}
        inputMode="tel"
        autoComplete="tel"
        placeholder={value.code === '+44' ? '07700 900123' : '98470 12345'}
        className={`${controlClass} w-full min-w-0`}
        value={value.number}
        onChange={(e) => onChange({ ...value, number: e.target.value })}
      />
    </div>
  );
}
