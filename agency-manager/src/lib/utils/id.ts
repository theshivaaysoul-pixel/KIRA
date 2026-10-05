// src/lib/utils/id.ts
// Server-side monotonic ID generator for all KIRA entities.
// Generates structured IDs like PLT-000001, ACC-000001, CNT-000001.

export function generateNextId(prefix: string, existingIds: string[]): string {
  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  let maxNumber = 0;

  for (const id of existingIds) {
    const match = id.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNumber = maxNumber + 1;
  const padded = String(nextNumber).padStart(6, '0');
  return `${prefix}-${padded}`;
}

export function isValidId(prefix: string, id: string): boolean {
  const regex = new RegExp(`^${prefix}-\\d{6}$`);
  return regex.test(id);
}
