export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function formatInventoryName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
}
