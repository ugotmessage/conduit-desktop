/**
 * OpenSSH-style Host pattern matching: `*` / `?` wildcards and `!` negation.
 * Matching is case-sensitive; the alias is the Host argument, not a canonical name.
 */

export function globMatch(value: string, pattern: string): boolean {
  let re = '';
  for (const ch of pattern) {
    if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(value);
}

/**
 * A Host line matches when at least one positive pattern matches and no
 * negated pattern matches. An empty pattern list never matches.
 */
export function hostLineMatches(alias: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  let positive = false;
  for (const raw of patterns) {
    if (raw.startsWith('!') && raw.length > 1) {
      if (globMatch(alias, raw.slice(1))) return false;
    } else if (globMatch(alias, raw)) {
      positive = true;
    }
  }
  return positive;
}
