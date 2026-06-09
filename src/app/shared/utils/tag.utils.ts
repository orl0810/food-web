export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function normalizeTags(tags: string[]): string[] {
  const normalized = new Set<string>();
  for (const tag of tags) {
    const value = normalizeTag(tag);
    if (value) {
      normalized.add(value);
    }
  }
  return [...normalized];
}

export function formatTagLabel(tag: string): string {
  if (!tag) {
    return '';
  }
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}
