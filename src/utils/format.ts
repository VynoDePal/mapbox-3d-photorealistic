// Truncate a string to `max` chars (counted in code units, not graphemes)
// and append an ellipsis when shortened. Returns the original string when
// already short enough.
export function truncate(input: string, max = 40): string {
  if (input.length <= max) return input;
  return input.slice(0, max - 1).trimEnd() + '…';
}
