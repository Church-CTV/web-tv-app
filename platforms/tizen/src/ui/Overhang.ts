/**
 * Tizen UI — re-exports from shared/ui for backward compatibility.
 */
export * from '@ctv/shared/ui/Overhang';

export function formatOverhangClock(now: Date): string {
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
}
