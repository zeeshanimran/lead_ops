export function label(value?: string | null) {
  if (!value) return '-';
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function shortDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value));
}
