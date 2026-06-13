export function labelize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatCell(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return value ?? '-';
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
