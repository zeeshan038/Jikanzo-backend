/** Normalize user search input per messaging spec (§10). */
export function normalizeSearchInput(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/[''`]/g, "'");
  s = s.replace(/[^\w\s']/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  const contractions: [RegExp, string][] = [
    [/\bi am\b/g, 'im'],
    [/\bi've\b/g, 'ive'],
    [/\bi'll\b/g, 'ill'],
    [/\bi'm\b/g, 'im'],
    [/\bwhat is\b/g, 'whats'],
    [/\bwhat's\b/g, 'whats'],
    [/\bcannot\b/g, 'cant'],
    [/\bcan't\b/g, 'cant'],
    [/\byou are\b/g, 'youre'],
    [/\byou're\b/g, 'youre'],
    [/\bare you\b/g, 'r u'],
    [/\bwhere are you\b/g, 'whr r u'],
    [/\bhave you\b/g, 'have u'],
  ];

  for (const [re, rep] of contractions) {
    s = s.replace(re, rep);
  }

  return s.replace(/\s+/g, ' ').trim();
}
