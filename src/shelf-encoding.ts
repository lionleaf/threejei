import { type Shelf, type Rod, type Plate, AVAILABLE_RODS, AVAILABLE_PLATES, createEmptyShelf, addRod, addPlate, regenerateGhostPlates } from './shelf-model.js';

/**
 * Current encoding version.
 * Increment this when making breaking changes to the encoding format.
 *
 * Version history:
 * - Version 2: Compressed array-based format (2024-12-17)
 *   - SKU names → numeric IDs
 *   - Field names → single chars (v, r, p)
 *   - Array-based rods/plates
 *   - Omit default y=0 for rods
 *   - ~65-67% size reduction
 * - Version 1: Initial versioned format (added 2024-12-17)
 * - Version 0: Legacy format without version field (before 2024-12-17)
 */
export const CURRENT_ENCODING_VERSION = 2;

/**
 * JSON structure for encoding/decoding shelves (Version 1)
 */
interface EncodedRod {
  pos: { x: number; y: number };
  sku: string;
}

interface EncodedPlate {
  y: number;
  sku: string;
  rods: number[]; // Rod indices (not IDs)
}

interface EncodedShelf {
  version: number;
  rods: EncodedRod[];
  plates: EncodedPlate[];
}

/**
 * Version 2: Compressed array-based format
 */
type CompressedRod = [number, number] | [number, number, number];

type CompressedPlate = [number, number, number[]];

interface EncodedShelfV2 {
  v: 2;
  r: CompressedRod[];
  p: CompressedPlate[];
}

/**
 * Encode shelf using Version 2 compressed format.
 * Uses array-based encoding for maximum compression (~65-67% reduction).
 */
function encodeShelfV2(shelf: Shelf): string {
  const sortedRods = Array.from(shelf.rods.entries())
    .sort(([_idA, rodA], [_idB, rodB]) => rodA.position.x - rodB.position.x);

  const rodIdToIndex = new Map<number, number>();
  sortedRods.forEach(([rodId, _], index) => {
    rodIdToIndex.set(rodId, index);
  });

  const encodedRods: CompressedRod[] = sortedRods.map(([_id, rod]) => {
    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    const skuId = rodSKU?.sku_id || 1;

    if (rod.position.y === 0) {
      return [rod.position.x, skuId];
    } else {
      return [rod.position.x, rod.position.y, skuId];
    }
  });

  const encodedPlates: CompressedPlate[] = Array.from(shelf.plates.values()).map(plate => {
    const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
    const skuId = plateSKU?.sku_id || 1;
    const rodIndices = plate.connections.map(rodId => rodIdToIndex.get(rodId) ?? -1);

    return [plate.y, skuId, rodIndices];
  });

  const encodedShelf: EncodedShelfV2 = {
    v: 2,
    r: encodedRods,
    p: encodedPlates
  };

  const jsonString = JSON.stringify(encodedShelf);
  return toUrlSafeBase64(jsonString);
}

/**
 * Decode shelf from Version 2 compressed format.
 */
function decodeShelfV2(data: EncodedShelfV2): Shelf {
  const shelf = createEmptyShelf();

  const rodIdMapping: number[] = [];
  data.r.forEach((compressedRod) => {
    let x: number, y: number, skuId: number;

    if (compressedRod.length === 2) {
      [x, skuId] = compressedRod;
      y = 0;
    } else {
      [x, y, skuId] = compressedRod;
    }

    const rodId = addRod({ x, y }, skuId, shelf);
    rodIdMapping.push(rodId);
  });

  data.p.forEach(([y, skuId, rodIndices]) => {
    const rodIds = rodIndices
      .map(index => rodIdMapping[index])
      .filter(id => id !== undefined);

    if (rodIds.length >= 2) {
      addPlate(y, skuId, rodIds, shelf);
    }
  });

  regenerateGhostPlates(shelf);
  return shelf;
}

/**
 * Encode shelf using Version 1 format (verbose, readable).
 * Used for backward compatibility and debugging.
 */
function encodeShelfV1(shelf: Shelf): string {
  const sortedRods = Array.from(shelf.rods.entries())
    .sort(([_idA, rodA], [_idB, rodB]) => rodA.position.x - rodB.position.x);

  const rodIdToIndex = new Map<number, number>();
  sortedRods.forEach(([rodId, _rod], index) => {
    rodIdToIndex.set(rodId, index);
  });

  const encodedRods: EncodedRod[] = sortedRods.map(([_rodId, rod]) => {
    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    return {
      pos: {
        x: rod.position.x,
        y: rod.position.y
      },
      sku: rodSKU?.name || ''
    };
  });

  const encodedPlates: EncodedPlate[] = Array.from(shelf.plates.values()).map(plate => {
    const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
    const rodIndices = plate.connections.map(rodId => rodIdToIndex.get(rodId) ?? -1);

    return {
      y: plate.y,
      sku: plateSKU?.name || '',
      rods: rodIndices
    };
  });

  const encodedShelf: EncodedShelf = {
    version: 1,
    rods: encodedRods,
    plates: encodedPlates
  };

  const jsonString = JSON.stringify(encodedShelf);
  return toUrlSafeBase64(jsonString);
}

/**
 * Encode a shelf configuration to a URL-safe base64 string.
 * Uses Version 2 compressed format for optimal size.
 */
export function encodeShelf(shelf: Shelf): string {
  return encodeShelfV2(shelf);
}

/**
 * Decode shelf from Version 1 or Version 0 format.
 */
function decodeShelfV1(data: EncodedShelf): Shelf {
  const shelf = createEmptyShelf();
  const rodIndexToId = new Map<number, number>();

  data.rods.forEach((encodedRod, index) => {
    const rodSKU = AVAILABLE_RODS.find(r => r.name === encodedRod.sku);
    if (!rodSKU) {
      console.warn(`Unknown rod SKU: ${encodedRod.sku}, skipping`);
      return;
    }

    const rodId = addRod(encodedRod.pos, rodSKU.sku_id, shelf);
    rodIndexToId.set(index, rodId);
  });

  data.plates.forEach(encodedPlate => {
    const plateSKU = AVAILABLE_PLATES.find(p => p.name === encodedPlate.sku);
    if (!plateSKU) {
      console.warn(`Unknown plate SKU: ${encodedPlate.sku}, skipping`);
      return;
    }

    const rodIds = encodedPlate.rods
      .map(index => rodIndexToId.get(index))
      .filter((id): id is number => id !== undefined);

    if (rodIds.length !== encodedPlate.rods.length) {
      console.warn(`Some rod indices could not be mapped for plate at Y=${encodedPlate.y}, skipping`);
      return;
    }

    addPlate(encodedPlate.y, plateSKU.sku_id, rodIds, shelf);
  });

  regenerateGhostPlates(shelf);
  return shelf;
}

/**
 * Decode a base64-encoded shelf configuration.
 * Handles all versions (V2, V1, V0) and returns an empty shelf on any error.
 */
export function decodeShelf(encoded: string): Shelf {
  try {
    const jsonString = fromUrlSafeBase64(encoded);
    const data = JSON.parse(jsonString);

    const version = data.version ?? data.v ?? 0;

    if (version > CURRENT_ENCODING_VERSION) {
      console.error(`Encoding version ${version} is newer than supported version ${CURRENT_ENCODING_VERSION}`);
      console.error('Please update the application to load this shelf configuration.');
      return createEmptyShelf();
    }

    if (version === 0) {
      console.log('Loading legacy shelf encoding (no version field)');
    } else {
      console.log(`Loading shelf encoding version ${version}`);
    }

    if (version === 2) {
      if (!data.r || !Array.isArray(data.r)) {
        console.error('Invalid V2 shelf encoding: missing or invalid rods array');
        return createEmptyShelf();
      }
      if (!data.p || !Array.isArray(data.p)) {
        console.error('Invalid V2 shelf encoding: missing or invalid plates array');
        return createEmptyShelf();
      }
      return decodeShelfV2(data as EncodedShelfV2);
    } else {
      if (!data.rods || !Array.isArray(data.rods)) {
        console.error('Invalid shelf encoding: missing or invalid rods array');
        return createEmptyShelf();
      }
      if (!data.plates || !Array.isArray(data.plates)) {
        console.error('Invalid shelf encoding: missing or invalid plates array');
        return createEmptyShelf();
      }
      return decodeShelfV1(data as EncodedShelf);
    }
  } catch (error) {
    console.error('Error decoding shelf:', error);
    return createEmptyShelf();
  }
}

/**
 * Validate if a string is a valid shelf encoding.
 * Does a quick check without fully reconstructing the shelf.
 */
export function validateEncoding(encoded: string): boolean {
  try {
    const jsonString = fromUrlSafeBase64(encoded);
    const data = JSON.parse(jsonString);

    // Check version compatibility
    const version = data.version ?? 0;
    if (version > CURRENT_ENCODING_VERSION) {
      return false;  // Unsupported future version
    }

    // Check for required fields
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.rods) &&
      Array.isArray(data.plates)
    );
  } catch {
    return false;
  }
}

/**
 * Convert a string to URL-safe base64.
 * Replaces + with -, / with _, and removes trailing =
 */
function toUrlSafeBase64(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert URL-safe base64 back to a string.
 */
function fromUrlSafeBase64(encoded: string): string {
  // Add back padding if needed
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  return decodeURIComponent(escape(atob(base64)));
}

/**
 * Convert shelf to V2 object (for JSON export).
 */
function encodeShelfToV2Object(shelf: Shelf): EncodedShelfV2 {
  const sortedRods = Array.from(shelf.rods.entries())
    .sort(([_idA, rodA], [_idB, rodB]) => rodA.position.x - rodB.position.x);

  const rodIdToIndex = new Map<number, number>();
  sortedRods.forEach(([rodId, _], index) => {
    rodIdToIndex.set(rodId, index);
  });

  const encodedRods: CompressedRod[] = sortedRods.map(([_id, rod]) => {
    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    const skuId = rodSKU?.sku_id || 1;

    if (rod.position.y === 0) {
      return [rod.position.x, skuId];
    } else {
      return [rod.position.x, rod.position.y, skuId];
    }
  });

  const encodedPlates: CompressedPlate[] = Array.from(shelf.plates.values()).map(plate => {
    const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
    const skuId = plateSKU?.sku_id || 1;
    const rodIndices = plate.connections.map(rodId => rodIdToIndex.get(rodId) ?? -1);

    return [plate.y, skuId, rodIndices];
  });

  return {
    v: 2,
    r: encodedRods,
    p: encodedPlates
  };
}

/**
 * Encode shelf to JSON string (no base64).
 * Uses Version 2 compressed format.
 */
export function encodeShelfToJSON(shelf: Shelf): string {
  const encodedShelf = encodeShelfToV2Object(shelf);
  return JSON.stringify(encodedShelf);
}

/**
 * Decode shelf from JSON string (no base64).
 * Handles all versions (V2, V1, V0).
 */
export function decodeShelfFromJSON(jsonString: string): Shelf {
  try {
    const data = JSON.parse(jsonString);

    const version = data.version ?? data.v ?? 0;

    if (version > CURRENT_ENCODING_VERSION) {
      console.error(`Encoding version ${version} is newer than supported version ${CURRENT_ENCODING_VERSION}`);
      console.error('Please update the application to load this shelf configuration.');
      return createEmptyShelf();
    }

    if (version === 0) {
      console.log('Loading legacy shelf encoding (no version field)');
    } else {
      console.log(`Loading shelf encoding version ${version}`);
    }

    if (version === 2) {
      if (!data.r || !Array.isArray(data.r)) {
        console.error('Invalid V2 shelf encoding: missing or invalid rods array');
        return createEmptyShelf();
      }
      if (!data.p || !Array.isArray(data.p)) {
        console.error('Invalid V2 shelf encoding: missing or invalid plates array');
        return createEmptyShelf();
      }
      return decodeShelfV2(data as EncodedShelfV2);
    } else {
      if (!data.rods || !Array.isArray(data.rods)) {
        console.error('Invalid shelf encoding: missing or invalid rods array');
        return createEmptyShelf();
      }
      if (!data.plates || !Array.isArray(data.plates)) {
        console.error('Invalid shelf encoding: missing or invalid plates array');
        return createEmptyShelf();
      }
      return decodeShelfV1(data as EncodedShelf);
    }
  } catch (error) {
    console.error('Failed to decode shelf from JSON:', error);
    return createEmptyShelf();
  }
}

/**
 * Apply an encoded shelf state to an existing shelf object.
 * Clears the current shelf and reconstructs it from the encoding.
 * @param encoded - Base64-encoded shelf configuration
 * @param shelf - Shelf object to apply the state to
 * @returns true if successful, false if decoding failed
 */
export function applyEncodedState(encoded: string, shelf: Shelf): boolean {
  try {
    // Decode the shelf configuration
    const decodedShelf = decodeShelf(encoded);

    // Clear the current shelf
    shelf.rods.clear();
    shelf.plates.clear();
    shelf.ghostPlates.length = 0;

    // Copy all rods
    decodedShelf.rods.forEach((rod, rodId) => {
      shelf.rods.set(rodId, rod);
    });

    // Copy all plates
    decodedShelf.plates.forEach((plate, plateId) => {
      shelf.plates.set(plateId, plate);
    });

    // Update metadata
    shelf.metadata.nextId = decodedShelf.metadata.nextId;

    // Regenerate ghost plates
    regenerateGhostPlates(shelf);

    return true;
  } catch (error) {
    console.error('Failed to apply encoded state:', error);
    return false;
  }
}
