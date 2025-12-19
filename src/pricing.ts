import type { Shelf } from './shelf-model.js';
import { getRodSKU, getPlateSKU } from './shelf-model.js';
import pricesData from './prices.json' with { type: 'json' };

export interface PriceData {
  rods: Record<string, number>;
  plates: Record<string, number>;
  accessories: {
    support_rod: number;
  };
}

export interface PricedComponent {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ShelfPricing {
  rods: PricedComponent[];
  plates: PricedComponent[];
  supportRods: PricedComponent;
  totalPrice: number;
}

/**
 * Load prices from JSON file (or URL in future)
 */
export async function loadPrices(): Promise<PriceData> {
  // For now, directly import the JSON file
  // In the future, this can be modified to fetch from a URL:
  // const response = await fetch(url);
  // return await response.json();
  return pricesData as PriceData;
}

/**
 * Count total attachment points across all rods in a shelf
 */
function countAttachmentPoints(shelf: Shelf): number {
  let total = 0;
  shelf.rods.forEach((rod) => {
    total += rod.attachmentPoints.length;
  });
  return total;
}

/**
 * Calculate complete pricing breakdown for a shelf
 */
export function calculateShelfPricing(shelf: Shelf, prices: PriceData): ShelfPricing {
  const rodCounts = new Map<string, number>();
  const plateCounts = new Map<string, number>();

  // Count rods by SKU name
  shelf.rods.forEach((rod) => {
    const rodSKU = getRodSKU(rod.sku_id);
    if (rodSKU) {
      rodCounts.set(rodSKU.name, (rodCounts.get(rodSKU.name) || 0) + 1);
    }
  });

  // Count plates by SKU name
  shelf.plates.forEach((plate) => {
    const plateSKU = getPlateSKU(plate.sku_id);
    if (plateSKU) {
      plateCounts.set(plateSKU.name, (plateCounts.get(plateSKU.name) || 0) + 1);
    }
  });

  // Calculate priced rod components
  // IMPORTANT: Each rod in the data model represents 2 physical rods (wall + front)
  const pricedRods: PricedComponent[] = [];
  let totalPrice = 0;

  rodCounts.forEach((count, name) => {
    const unitPrice = prices.rods[name] || 0;
    const physicalCount = count * 2; // 2 physical rods per data model rod
    const totalRodPrice = physicalCount * unitPrice;

    pricedRods.push({
      name,
      quantity: physicalCount,
      unitPrice,
      totalPrice: totalRodPrice
    });

    totalPrice += totalRodPrice;
  });

  // Calculate priced plate components
  const pricedPlates: PricedComponent[] = [];

  plateCounts.forEach((count, name) => {
    const unitPrice = prices.plates[name] || 0;
    const totalPlatePrice = count * unitPrice;

    pricedPlates.push({
      name,
      quantity: count,
      unitPrice,
      totalPrice: totalPlatePrice
    });

    totalPrice += totalPlatePrice;
  });

  // Calculate support rods (1 per attachment point)
  const supportRodCount = countAttachmentPoints(shelf);
  const supportRodUnitPrice = prices.accessories.support_rod;
  const supportRodTotalPrice = supportRodCount * supportRodUnitPrice;

  const supportRods: PricedComponent = {
    name: 'Support Rod',
    quantity: supportRodCount,
    unitPrice: supportRodUnitPrice,
    totalPrice: supportRodTotalPrice
  };

  totalPrice += supportRodTotalPrice;

  return {
    rods: pricedRods,
    plates: pricedPlates,
    supportRods,
    totalPrice
  };
}

/**
 * Format a price in NOK currency
 */
export function formatPrice(price: number): string {
  return `${price.toFixed(2)} kr`;
}
