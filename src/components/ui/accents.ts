/** Accent colours shared by cards, icon squares and pills (static strings so Tailwind sees them). */
export const ACCENTS = {
  blue: { border: 'border-blue-200', label: 'text-blue-900', text: 'text-blue-600', solid: 'bg-blue-600 text-white', soft: 'bg-blue-50 text-blue-600 border border-blue-100', pill: 'bg-blue-50 text-blue-700 border-blue-100' },
  emerald: { border: 'border-emerald-200', label: 'text-emerald-900', text: 'text-emerald-600', solid: 'bg-emerald-600 text-white', soft: 'bg-emerald-50 text-emerald-600 border border-emerald-100', pill: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  orange: { border: 'border-orange-200', label: 'text-orange-900', text: 'text-orange-600', solid: 'bg-orange-500 text-white', soft: 'bg-orange-50 text-orange-600 border border-orange-100', pill: 'bg-orange-50 text-orange-700 border-orange-100' },
  purple: { border: 'border-purple-200', label: 'text-purple-900', text: 'text-purple-600', solid: 'bg-purple-600 text-white', soft: 'bg-purple-50 text-purple-600 border border-purple-100', pill: 'bg-purple-50 text-purple-700 border-purple-100' },
  indigo: { border: 'border-indigo-200', label: 'text-indigo-900', text: 'text-indigo-600', solid: 'bg-indigo-600 text-white', soft: 'bg-indigo-50 text-indigo-600 border border-indigo-100', pill: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  teal: { border: 'border-teal-200', label: 'text-teal-900', text: 'text-teal-600', solid: 'bg-teal-600 text-white', soft: 'bg-teal-50 text-teal-600 border border-teal-100', pill: 'bg-teal-50 text-teal-700 border-teal-100' },
  rose: { border: 'border-rose-200', label: 'text-rose-900', text: 'text-rose-600', solid: 'bg-rose-600 text-white', soft: 'bg-rose-50 text-rose-600 border border-rose-100', pill: 'bg-rose-50 text-rose-700 border-rose-100' },
  gray: { border: 'border-gray-300', label: 'text-gray-900', text: 'text-gray-700', solid: 'bg-neutral-900 text-white', soft: 'bg-gray-50 text-gray-600 border border-gray-200', pill: 'bg-gray-50 text-gray-700 border-gray-200' },
} as const;

export type Accent = keyof typeof ACCENTS;
