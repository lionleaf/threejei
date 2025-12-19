import type { RodSKU, PlateSKU, Rod, Plate } from './shelf-model.js';

/**
 * Calculate total height from spans array
 * Replaces 6+ duplicated instances of spans.reduce() across codebase
 */
export function getTotalSpanLength(spans: number[]): number {
  return spans.reduce((sum, span) => sum + span, 0);
}

/**
 * Calculate rod's total height including all spans
 */
export function getRodHeight(rodSKU: RodSKU): number {
  return getTotalSpanLength(rodSKU.spans);
}

/**
 * Calculate rod's physical bounds including padding
 */
export function getRodBounds(rod: Rod, rodSKU: RodSKU, padding: number): { bottom: number; top: number } {
  const height = getRodHeight(rodSKU);
  return {
    bottom: rod.position.y - padding,
    top: rod.position.y + height + padding
  };
}

/**
 * Calculate relative attachment Y coordinate for a plate on a rod
 * Replaces 4+ duplicated instances of (plate.y - rod.position.y)
 */
export function getRelativeAttachmentY(plate: Plate, rod: Rod): number {
  return plate.y - rod.position.y;
}
