import { controlClass, FormField, Select, TextArea } from '@/components/ui/controls';
import { CONCENTRATIONS, FRAGRANCE_FAMILIES, OCCASION_LABEL, PROJECTION_LABEL, SEASON_LABEL, type Occasion, type Perfume, type ProfileInput, type Projection, type Season } from './api';

/*
 * The fragrance profile part of the perfume editor: the facts customers ask
 * about. Everything is optional; the website shows only what is filled in,
 * so leave a field empty rather than guess.
 */

/** The form's working copy: lists as comma-separated text, numbers as text. */
export type ProfileDraft = {
  concentration: string;
  top: string;
  heart: string;
  base: string;
  fragranceFamily: string;
  longevityMin: string;
  longevityMax: string;
  projection: Projection | '';
  seasons: Season[];
  occasions: Occasion[];
  similarScents: string;
  keyIngredients: string;
  allergens: string;
  perfumer: string;
  launchYear: string;
};

export function draftOf(perfume: Perfume): ProfileDraft {
  const { profile, notes } = perfume;
  return {
    concentration: perfume.concentration,
    top: notes.top.join(', '),
    heart: notes.heart.join(', '),
    base: notes.base.join(', '),
    fragranceFamily: profile.fragranceFamily ?? '',
    longevityMin: profile.longevityHours ? String(profile.longevityHours.min) : '',
    longevityMax: profile.longevityHours ? String(profile.longevityHours.max) : '',
    projection: profile.projection ?? '',
    seasons: profile.seasons,
    occasions: profile.occasions,
    similarScents: profile.similarScents ?? '',
    keyIngredients: profile.keyIngredients.join(', '),
    allergens: profile.allergens ?? '',
    perfumer: profile.perfumer ?? '',
    launchYear: profile.launchYear ? String(profile.launchYear) : '',
  };
}

const list = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** Checks the draft; returns the request body, or the errors to show (keyed like the fields). */
export function readDraft(draft: ProfileDraft): { input: ProfileInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const min = draft.longevityMin.trim();
  const max = draft.longevityMax.trim();
  let longevityHours: ProfileInput['longevityHours'] = null;
  if (min || max) {
    const low = Number(min || max);
    const high = Number(max || min);
    if (!Number.isInteger(low) || !Number.isInteger(high) || low < 1 || high > 48) errors['profile.longevity'] = 'Whole hours between 1 and 48';
    else if (low > high) errors['profile.longevity'] = 'The first number should be the shorter time';
    else longevityHours = { min: low, max: high };
  }
  const year = draft.launchYear.trim();
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > new Date().getFullYear() + 1)) errors['profile.launchYear'] = 'A year, e.g. 2025';
  for (const [key, text] of [['top', draft.top], ['heart', draft.heart], ['base', draft.base], ['keyIngredients', draft.keyIngredients]] as const) {
    const items = list(text);
    if (items.length > 12) errors[`profile.${key}`] = 'Up to 12, separated by commas';
    else if (items.some((item) => item.length > 40)) errors[`profile.${key}`] = 'Each one up to 40 characters, separated by commas';
  }
  const text = (value: string) => value.trim() || null;
  return {
    errors,
    input: {
      concentration: draft.concentration,
      notes: { top: list(draft.top), heart: list(draft.heart), base: list(draft.base) },
      fragranceFamily: draft.fragranceFamily || null,
      longevityHours,
      projection: draft.projection || null,
      seasons: draft.seasons,
      occasions: draft.occasions,
      similarScents: text(draft.similarScents),
      keyIngredients: list(draft.keyIngredients),
      allergens: text(draft.allergens),
      perfumer: text(draft.perfumer),
      launchYear: year && !errors['profile.launchYear'] ? Number(year) : null,
    },
  };
}

function Choices<T extends string>({ legend, options, value, onChange }: { legend: string; options: Record<T, string>; value: T[]; onChange: (next: T[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(options) as T[]).map((key) => {
          const checked = value.includes(key);
          return (
            <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${checked ? 'border-fg bg-surface-muted' : 'border-border'}`}>
              <input type="checkbox" className="size-3.5 accent-current" checked={checked} onChange={() => onChange(checked ? value.filter((v) => v !== key) : [...value, key])} />
              {options[key]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProfileFields({ draft, onChange, errors }: { draft: ProfileDraft; onChange: (patch: Partial<ProfileDraft>) => void; errors: Record<string, string> }) {
  const input = (key: keyof ProfileDraft, props: { placeholder?: string; inputMode?: 'numeric' } = {}) => (
    <input id={`profile-${key}`} className={`${controlClass} w-full`} value={draft[key] as string} onChange={(e) => onChange({ [key]: e.target.value })} {...props} />
  );
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-sm font-medium">Fragrance profile</h3>
        <p className="text-xs text-fg-muted">Shown on the perfume’s page and used to answer customers’ questions. Fill in only what the perfumer has confirmed; empty fields are simply not shown.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Concentration" htmlFor="profile-concentration">
          <Select id="profile-concentration" className="w-full" value={draft.concentration} onChange={(e) => onChange({ concentration: e.target.value })}>
            {CONCENTRATIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Fragrance family" htmlFor="profile-fragranceFamily" hint="Also used to suggest related perfumes.">
          <Select id="profile-fragranceFamily" className="w-full" value={draft.fragranceFamily} onChange={(e) => onChange({ fragranceFamily: e.target.value })}>
            <option value="">Not set</option>
            {FRAGRANCE_FAMILIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Top notes" htmlFor="profile-top" error={errors['profile.top']} hint="Separate with commas, e.g. Bergamot, Pink pepper">
        {input('top')}
      </FormField>
      <FormField label="Heart notes" htmlFor="profile-heart" error={errors['profile.heart']}>
        {input('heart')}
      </FormField>
      <FormField label="Base notes" htmlFor="profile-base" error={errors['profile.base']}>
        {input('base')}
      </FormField>
      <FormField label="Key ingredients" htmlFor="profile-keyIngredients" error={errors['profile.keyIngredients']} hint="The ones worth naming, separated by commas.">
        {input('keyIngredients')}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Lasts (hours on skin)" htmlFor="profile-longevityMin" error={errors['profile.longevity']} hint="From – to, e.g. 6 and 8. One number if it’s fixed.">
          <div className="flex items-center gap-2">
            {input('longevityMin', { inputMode: 'numeric', placeholder: 'From' })}
            <span className="text-fg-muted">–</span>
            <input aria-label="Lasts up to (hours)" className={`${controlClass} w-full`} inputMode="numeric" placeholder="To" value={draft.longevityMax} onChange={(e) => onChange({ longevityMax: e.target.value })} />
          </div>
        </FormField>
        <FormField label="Projection" htmlFor="profile-projection">
          <Select id="profile-projection" className="w-full" value={draft.projection} onChange={(e) => onChange({ projection: e.target.value as Projection | '' })}>
            <option value="">Not set</option>
            {(Object.keys(PROJECTION_LABEL) as Projection[]).map((key) => (
              <option key={key} value={key}>
                {PROJECTION_LABEL[key]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <Choices legend="Best seasons" options={SEASON_LABEL} value={draft.seasons} onChange={(seasons) => onChange({ seasons })} />
      <Choices legend="Best occasions" options={OCCASION_LABEL} value={draft.occasions} onChange={(occasions) => onChange({ occasions })} />

      <FormField label="Similar scent profile" htmlFor="profile-similarScents" hint="Describe the style, e.g. “Fresh aquatic with a woody dry-down”. Avoid naming other brands’ perfumes.">
        {input('similarScents')}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Perfumer" htmlFor="profile-perfumer">
          {input('perfumer')}
        </FormField>
        <FormField label="Launch year" htmlFor="profile-launchYear" error={errors['profile.launchYear']}>
          {input('launchYear', { inputMode: 'numeric', placeholder: 'e.g. 2025' })}
        </FormField>
      </div>
      <FormField label="Allergen information" htmlFor="profile-allergens" hint="As printed on the box or supplied by the perfumer, e.g. “Contains linalool, limonene, citral”.">
        <TextArea id="profile-allergens" rows={2} value={draft.allergens} onChange={(e) => onChange({ allergens: e.target.value })} />
      </FormField>
    </section>
  );
}
