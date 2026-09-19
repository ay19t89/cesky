const czechCollator = new Intl.Collator('cs', {
  sensitivity: 'base',
  usage: 'sort'
});

export function compareCzechWords(left: string, right: string): number {
  return czechCollator.compare(left, right);
}
