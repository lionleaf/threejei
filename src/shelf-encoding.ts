import { type Shelf, type Rod, type Plate, AVAILABLE_RODS, AVAILABLE_PLATES, createEmptyShelf, addRod, addPlate, regenerateGhostPlates } from './shelf-model.js';

/**
 * JSON structure for encoding/decoding shelves
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
  rods: EncodedRod[];
  plates: EncodedPlate[];
}

/**
 * Encode a shelf configuration to a URL-safe base64 string.
 * Uses verbose JSON format for readability when decoded.
 */
export function encodeShelf(shelf: Shelf): string {
  // Sort rods by X position for consistent ordering
  const sortedRods = Array.from(shelf.rods.entries())
    .sort(([_idA, rodA], [_idB, rodB]) => rodA.position.x - rodB.position.x);

  // Create ID-to-index mapping
  const rodIdToIndex = new Map<number, number>();
  sortedRods.forEach(([rodId, _rod], index) => {
    rodIdToIndex.set(rodId, index);
  });

  // Encode rods
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

  // Encode plates
  const encodedPlates: EncodedPlate[] = Array.from(shelf.plates.values()).map(plate => {
    const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
    // Map rod IDs to indices
    const rodIndices = plate.connections.map(rodId => rodIdToIndex.get(rodId) ?? -1);

    return {
      y: plate.y,
      sku: plateSKU?.name || '',
      rods: rodIndices
    };
  });

  const encodedShelf: EncodedShelf = {
    rods: encodedRods,
    plates: encodedPlates
  };

  // Convert to JSON string (no whitespace)
  const jsonString = JSON.stringify(encodedShelf);

  // Base64 encode (URL-safe)
  return toUrlSafeBase64(jsonString);
}

/**
 * Decode a base64-encoded shelf configuration.
 * Returns an empty shelf on any error.
 */
export function decodeShelf(encoded: string): Shelf {
  try {
    // Base64 decode
    const jsonString = fromUrlSafeBase64(encoded);

    // Parse JSON
    const data = JSON.parse(jsonString) as EncodedShelf;

    // Validate structure
    if (!data.rods || !Array.isArray(data.rods)) {
      console.error('Invalid shelf encoding: missing or invalid rods array');
      return createEmptyShelf();
    }
    if (!data.plates || !Array.isArray(data.plates)) {
      console.error('Invalid shelf encoding: missing or invalid plates array');
      return createEmptyShelf();
    }

    // Create empty shelf
    const shelf = createEmptyShelf();

    // Track rod index-to-ID mapping
    const rodIndexToId = new Map<number, number>();

    // Decode and add rods
    data.rods.forEach((encodedRod, index) => {
      const rodSKU = AVAILABLE_RODS.find(r => r.name === encodedRod.sku);
      if (!rodSKU) {
        console.warn(`Unknown rod SKU: ${encodedRod.sku}, skipping`);
        return;
      }

      const rodId = addRod(encodedRod.pos, rodSKU.sku_id, shelf);
      rodIndexToId.set(index, rodId);
    });

    // Decode and add plates
    data.plates.forEach(encodedPlate => {
      const plateSKU = AVAILABLE_PLATES.find(p => p.name === encodedPlate.sku);
      if (!plateSKU) {
        console.warn(`Unknown plate SKU: ${encodedPlate.sku}, skipping`);
        return;
      }

      // Map rod indices to IDs
      const rodIds = encodedPlate.rods
        .map(index => rodIndexToId.get(index))
        .filter((id): id is number => id !== undefined);

      if (rodIds.length !== encodedPlate.rods.length) {
        console.warn(`Some rod indices could not be mapped for plate at Y=${encodedPlate.y}, skipping`);
        return;
      }

      addPlate(encodedPlate.y, plateSKU.sku_id, rodIds, shelf);
    });

    return shelf;
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
 * Encode shelf to pretty-printed JSON string (no base64).
 */
export function encodeShelfToJSON(shelf: Shelf): string {
  // Sort rods by X position for consistent ordering
  const sortedRods = Array.from(shelf.rods.entries())
    .sort(([_idA, rodA], [_idB, rodB]) => rodA.position.x - rodB.position.x);

  // Create ID-to-index mapping
  const rodIdToIndex = new Map<number, number>();
  sortedRods.forEach(([rodId, _rod], index) => {
    rodIdToIndex.set(rodId, index);
  });

  // Encode rods
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

  // Encode plates
  const encodedPlates: EncodedPlate[] = Array.from(shelf.plates.values()).map(plate => {
    const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
    // Map rod IDs to indices
    const rodIndices = plate.connections.map(rodId => rodIdToIndex.get(rodId) ?? -1);

    return {
      y: plate.y,
      sku: plateSKU?.name || '',
      rods: rodIndices
    };
  });

  const encodedShelf: EncodedShelf = {
    rods: encodedRods,
    plates: encodedPlates
  };

  // Convert to pretty-printed JSON string
  return JSON.stringify(encodedShelf, null, 2);
}

/**
 * Decode shelf from JSON string (no base64).
 */
export function decodeShelfFromJSON(jsonString: string): Shelf {
  try {
    // Parse JSON
    const data = JSON.parse(jsonString) as EncodedShelf;

    // Validate structure
    if (!data.rods || !Array.isArray(data.rods)) {
      console.error('Invalid shelf encoding: missing or invalid rods array');
      return createEmptyShelf();
    }
    if (!data.plates || !Array.isArray(data.plates)) {
      console.error('Invalid shelf encoding: missing or invalid plates array');
      return createEmptyShelf();
    }

    // Create new shelf
    const shelf = createEmptyShelf();

    // Add rods
    const rodIdMapping: number[] = [];
    data.rods.forEach((encodedRod) => {
      const rodSKU = AVAILABLE_RODS.find(r => r.name === encodedRod.sku);
      if (!rodSKU) {
        console.error(`Unknown rod SKU: ${encodedRod.sku}`);
        return;
      }

      const rodId = addRod(encodedRod.pos, rodSKU.sku_id, shelf);
      rodIdMapping.push(rodId);
    });

    // Add plates
    data.plates.forEach((encodedPlate) => {
      const plateSKU = AVAILABLE_PLATES.find(p => p.name === encodedPlate.sku);
      if (!plateSKU) {
        console.error(`Unknown plate SKU: ${encodedPlate.sku}`);
        return;
      }

      // Map rod indices back to IDs
      const rodIds = encodedPlate.rods
        .map(index => rodIdMapping[index])
        .filter(id => id !== undefined);

      if (rodIds.length < 2) {
        console.error(`Plate needs at least 2 rods, got ${rodIds.length}`);
        return;
      }

      addPlate(encodedPlate.y, plateSKU.sku_id, rodIds, shelf);
    });

    // Regenerate ghost plates
    regenerateGhostPlates(shelf);

    return shelf;
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
