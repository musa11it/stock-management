function randomSuffix(length: number): string {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

function datePart(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}${m}${d}`;
}

export function generateDocNumber(prefix: string): string {
  return `${prefix}-${datePart()}-${randomSuffix(5)}`;
}

/** Derives a readable SKU from a product name (e.g. "Cooking Oil" -> "COOK-38217") when none is given. */
export function generateSku(name: string): string {
  const prefix = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PROD';
  return `${prefix}-${randomSuffix(5)}`;
}
