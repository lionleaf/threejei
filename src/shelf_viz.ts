// Import functions from shelf-model.ts
import {
  createEmptyShelf,
  addRod,
  addPlate,
  calculateAttachmentPositions,
  regenerateGhostPlates,
  regenerateGhostRods,
  INNER_ROD_HEIGHT_PADDING,
  OUTER_ROD_HEIGHT_PADDING,
  getRodSKU,
  getPlateSKU,
  type Shelf,
  type Rod
} from './shelf-model.js';

import { getTotalSpanLength, getRodHeight } from './shelf-utils.js';

import { setupInteractions } from './interactions.js';
import { loadPrices, calculateShelfPricing, formatPrice, type PriceData } from './pricing.js';
import { encodeShelfToJSON, decodeShelfFromJSON, encodeShelf, decodeShelf } from './shelf-encoding.js';

// Declare THREE as global (loaded via CDN)
declare const THREE: any;

// Debug state to make colliders visible
export let DEBUG_SHOW_COLLIDERS = false;

// Getter function to access current debug state (for modules that import it)
export function getDebugMode(): boolean {
  return DEBUG_SHOW_COLLIDERS;
}

// Flag to enable/disable wall drawing
export let DRAW_WALL = false;

// Cached price data
let cachedPriceData: PriceData | null = null;

// Distance (in mm) between the two rods holding a plate
const rodDistance = 153

const rodRadius = 14
const plateThickness = 20
const connectionRodRadius = 6
// Import rod padding constants from shelf-model to ensure consistency
const innerRodHeightPadding = INNER_ROD_HEIGHT_PADDING
const outerRodHeightPadding = OUTER_ROD_HEIGHT_PADDING
const connectionRodGrooveDepth = 4

/**
 * Creates all meshes for a single logical rod (inner rod, outer rod, and connection rods).
 * @param rod - The rod data from shelf model
 * @param isGhost - Whether to render as ghost (transparent green) or normal
 * @param ghostOpacity - Optional opacity for ghost rods (defaults to 0.15)
 * @param ghostRodIndex - Index of ghost rod for userData (only used if isGhostRod is true)
 * @param rodId - ID of the rod for userData (only used if not a ghost)
 * @returns Array of THREE.Mesh objects to add to scene
 */
function createRodMeshes(
  rod: Rod,
  isGhost: boolean,
  ghostOpacity: number = 0.15,
  ghostRodIndex?: number,
  rodId?: number
): any[] {
  const meshes: any[] = [];

  // Ghost rods (merge preview) use smaller radius than ghost plate rods (extension preview)
  const radiusDelta = isGhost ? -3 : 0;
  const radius = rodRadius + radiusDelta;

  const rodSKU = getRodSKU(rod.sku_id);
  let height = rodSKU ? getRodHeight(rodSKU) : 0;
  height += isGhost ? -4 : 0; // Slightly shorter for ghost rods to avoid z-fighting (2mm on each end)

  // Determine material based on ghost/normal mode
  const rodMaterial = isGhost
    ? new THREE.MeshBasicMaterial({
      color: 0x90EE90, // Light green
      transparent: true,
      opacity: ghostOpacity // Will be set to 0.5 on hover
    })
    : new THREE.MeshStandardMaterial({
      color: 0x76685e,
      roughness: 0.7,
      metalness: 0.0
    });

  // [bool innerRod, radius]. The inner rod is the one attached to the wall
  const zPositions = [[true, radius - radiusDelta], [false, rodDistance + radius - radiusDelta]];

  // Create two rods - one at front, one at back
  zPositions.forEach(([innerRod, zPos]) => {
    const rodPadding = innerRod ? innerRodHeightPadding : outerRodHeightPadding;
    const rodHeight = height + rodPadding * 2 + plateThickness;

    // Main cylinder body
    const rodRadialSegments = 32;
    const rodGeometry = new THREE.CylinderGeometry(radius, radius, rodHeight, rodRadialSegments, 1, false);
    rodGeometry.computeVertexNormals();
    const rodMesh = new THREE.Mesh(rodGeometry, rodMaterial.clone());
    rodMesh.position.set(rod.position.x, rod.position.y + rodHeight / 2 - rodPadding - plateThickness / 2, zPos);

    // Set userData based on rod type
    if (isGhost) {
      rodMesh.userData = {
        type: 'ghostRod',
        ghostRodIndex: ghostRodIndex,
        isLegal: true
      };
      rodMesh.renderOrder = -1; // Render behind real rods
    } else {
      rodMesh.userData = { type: 'rod', rodId: rodId };
    }

    meshes.push(rodMesh);
  });

  // Add horizontal connecting rods between front and back vertical rods at attachment points
  rod.attachmentPoints.forEach(ap => {
    const attachmentY = rod.position.y + ap.y - plateThickness / 2 - connectionRodRadius + connectionRodGrooveDepth;

    // Connection rod material
    const connectionRodMaterial = isGhost
      ? new THREE.MeshBasicMaterial({
        color: 0x90EE90, // Light green
        transparent: true,
        opacity: ghostOpacity // Will be set to 0.5 on hover
      })
      : new THREE.MeshStandardMaterial({
        color: 0x76685e,
        roughness: 0.7,
        metalness: 0.0
      });

    let length = 202 + (isGhost ? -5 : 0); // Slightly shorter for ghost rods to avoid z-fighting
    let radius = connectionRodRadius + (isGhost ? -2 : 0); // Slightly smaller for ghost rods

    // Horizontal cylinder connecting front (Z=0) to back (Z=200)
    const connectionRodGeometry = new THREE.CylinderGeometry(radius, radius, length, 16);
    connectionRodGeometry.computeVertexNormals();
    const connectionRod = new THREE.Mesh(connectionRodGeometry, connectionRodMaterial);

    // Rotate to align with Z-axis (default cylinder is along Y-axis)
    connectionRod.rotation.x = Math.PI / 2;

    // Position at the attachment point, centered in Z
    connectionRod.position.set(rod.position.x, attachmentY + (isGhost ? 1 : 0), length / 2 + (isGhost ? 2.5 : 0));
    connectionRod.userData = { type: isGhost ? 'ghost_connection_rod' : 'connection_rod' };

    meshes.push(connectionRod);
  });

  return meshes;
}

/**
 * Creates a wall behind the shelf with a grid pattern.
 * Grid lines every 20cm, with thicker lines every 60cm (3 × 20cm).
 */
function createWallGrid(scene: any, shelf: Shelf): void {
  const rods = Array.from(shelf.rods.values());

  // Calculate leftmost rod position for label alignment (0 reference)
  let leftmostX = 0;
  if (rods.length > 0) {
    const xPositions = rods.map(rod => rod.position.x);
    leftmostX = Math.min(...xPositions);
  }

  // Fixed wall size - large enough for most configurations
  const wallWidth = 10240; // 10m wide
  const wallHeight = 6000; // >3m tall
  const minX = -4800;
  const maxX = minX + wallWidth;
  const minY = -2 * 600;
  const maxY = minY + wallHeight;

  const wallZ = -10; // Position wall slightly behind the inner rods

  // Grid spacing constants
  const smallGridSpacing = 200; // 20cm in mm
  const largeGridSpacing = 600; // 60cm in mm

  // Create grid texture
  const textureWidth = 2048;
  const textureHeight = 260 * 2;
  const canvas = document.createElement('canvas');
  canvas.width = textureWidth;
  canvas.height = textureHeight;
  const context = canvas.getContext('2d')!;

  // Fill with white background
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, textureWidth, textureHeight);

  // Calculate grid cell size in texture pixels
  const cellSize = textureWidth / (wallWidth / smallGridSpacing);

  // Draw vertical lines
  for (let i = 0; i <= textureWidth / cellSize; i++) {
    const x = i * cellSize;
    const isThickLine = Math.abs(i % 3) < 0.1; // Every 3rd line is thick (60cm)

    if (isThickLine) {
      context.strokeStyle = 'rgba(153, 153, 153, 0.8)'; // #999999 with 0.8 opacity
      context.lineWidth = 3;
    } else {
      context.strokeStyle = 'rgba(221, 221, 221, 0.5)'; // #dddddd with 0.5 opacity
      context.lineWidth = 1;
    }

    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, textureHeight);
    context.stroke();
  }

  // Draw horizontal lines
  for (let i = 0; i <= textureHeight / cellSize; i++) {
    const y = i * cellSize;
    const isThickLine = Math.abs(i % 3) < 0.1; // Every 3rd line is thick (60cm)

    if (isThickLine) {
      context.strokeStyle = 'rgba(153, 153, 153, 0.8)';
      context.lineWidth = 3;
    } else {
      context.strokeStyle = 'rgba(221, 221, 221, 0.5)';
      context.lineWidth = 1;
    }

    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(textureWidth, y);
    context.stroke();
  }

  // Create texture from canvas
  const gridTexture = new THREE.CanvasTexture(canvas);
  gridTexture.wrapS = THREE.RepeatWrapping;
  gridTexture.wrapT = THREE.RepeatWrapping;
  gridTexture.repeat.set(
    wallWidth / smallGridSpacing / (textureWidth / cellSize),
    wallHeight / smallGridSpacing / (textureHeight / cellSize)
  );
  gridTexture.minFilter = THREE.LinearFilter;
  gridTexture.magFilter = THREE.LinearFilter;

  // Calculate bottom of shelf for label positioning
  let shelfBottomY = 0;
  if (rods.length > 0) {
    const yPositions = rods.map(rod => rod.position.y);
    shelfBottomY = Math.min(...yPositions);
  }

  // Find the closest 60cm grid line that is at least 20cm below the shelf bottom
  const minLabelY = shelfBottomY - 200; // At least 200mm (20cm) below shelf
  const labelY = Math.floor(minLabelY / largeGridSpacing) * largeGridSpacing;
  for (let x = Math.floor(minX / largeGridSpacing) * largeGridSpacing; x <= maxX; x += largeGridSpacing) {
    // Calculate label value relative to leftmost rod (0 at leftmost)
    const labelValueCm = Math.round((x - leftmostX) / 10); // Convert mm to cm

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 96;

    context.fillStyle = '#666666';
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';

    // Draw the main number
    context.font = 'bold 60px Arial';
    context.fillText(`${labelValueCm}`, 128, 60);

    // Draw "cm" subscript
    context.font = 'bold 30px Arial';
    context.fillText('cm', 190, 60);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    const labelGeometry = new THREE.PlaneGeometry(120, 50);
    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    labelMesh.position.set(x, labelY, wallZ + 1);
    labelMesh.userData = { type: 'wall_label' };
    scene.add(labelMesh);
  }

  // Add wall background plane with grid texture
  const wallGeometry = new THREE.PlaneGeometry(wallWidth, wallHeight);
  const wallMaterial = new THREE.MeshBasicMaterial({
    map: gridTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0
  });

  const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
  wallMesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, wallZ);
  wallMesh.userData = { type: 'wall_background' };
  scene.add(wallMesh);
}

// Rebuild all shelf geometry (rods, plates, gap colliders)
function rebuildShelfGeometry(shelf: Shelf, scene: any, skuListContainer?: HTMLDivElement): void {
  // Remove all children from scene
  scene.clear();

  // Re-add lighting (cleared by scene.clear())
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(500, 1000, 500);
  scene.add(directionalLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
  backLight.position.set(-500, 500, -500);
  scene.add(backLight);

  // Add wall with grid pattern
  if (DRAW_WALL) {
    createWallGrid(scene, shelf);
  }

  // Create gradient map for toon/cell shading with more steps for smoother transitions
  const gradientMap = new THREE.DataTexture(
    new Uint8Array([
      0, 0, 0,        // Dark shadow
      64, 64, 64,     // Shadow
      96, 96, 96,     // Mid-shadow
      128, 128, 128,  // Mid-tone
      160, 160, 160,  // Mid-light
      192, 192, 192,  // Light
      255, 255, 255   // Highlight
    ]),
    7, 1, THREE.RGBFormat
  );
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;

  // Update SKU list if container is provided
  if (skuListContainer) {
    updateSKUList(shelf, skuListContainer);
  }

  // Generate rod geometry (each logical rod is two physical rods)
  shelf.rods.forEach((rod, rodId) => {
    const meshes = createRodMeshes(rod, false, 0.15, undefined, rodId);
    meshes.forEach(mesh => {
      mesh.userData.rodId = rodId; // Ensure rodId is set for interactions
      scene.add(mesh);
    });
  });

  // Generate plate geometry
  shelf.plates.forEach((plate, plateId) => {
    const plateSKU = getPlateSKU(plate.sku_id);
    if (!plateSKU) return;

    const plateWidth = getTotalSpanLength(plateSKU.spans);

    // Calculate plate center position from connected rods
    const connectedRods = plate.connections.map(id => shelf.rods.get(id)).filter(rod => rod !== undefined);
    if (connectedRods.length === 0) return;

    const centerX = connectedRods.reduce((sum, rod) => sum + rod.position.x, 0) / connectedRods.length;

    const plateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(plateWidth, plateThickness, plateSKU.depth),
      new THREE.MeshStandardMaterial({
        color: 0x76685e,
        roughness: 0.7,
        metalness: 0.0
      })
    );
    plateMesh.position.set(centerX, plate.y, plateSKU.depth / 2);

    // Store plate data for raycasting
    plateMesh.userData = {
      type: 'plate',
      plateId: plateId,
      shelf: shelf
    };

    scene.add(plateMesh);
  });

  // Generate ghost plate visualizations
  regenerateGhostPlates(shelf);
  regenerateGhostRods(shelf);

  shelf.ghostPlates.forEach((ghostPlate, index) => {
    const width = ghostPlate.width || 600;
    const centerX = ghostPlate.midpointPosition.x;

    let ghostColor = 0x90EE90; // Light green for legal
    let ghostOpacity = 0.15; // Default faint opacity for legal ghosts

    if (!ghostPlate.legal) {
      ghostColor = 0xff0000; // Red for illegal
      ghostOpacity = DEBUG_SHOW_COLLIDERS ? 0.3 : 0.0; // Only show illegal in debug mode
    } else if (DEBUG_SHOW_COLLIDERS) {
      ghostOpacity = 0.3; // Brighter in debug mode
    }

    const ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, plateThickness - 6, 200 - 15),
      new THREE.MeshBasicMaterial({
        color: ghostColor,
        transparent: true,
        opacity: ghostOpacity,
        wireframe: !ghostPlate.legal
      })
    );

    ghostMesh.position.set(centerX, ghostPlate.midpointPosition.y, 200 / 2);
    ghostMesh.userData = {
      type: 'ghost_plate',
      ghostPlateIndex: index,
      ghostPlate: ghostPlate
    };

    scene.add(ghostMesh);

    // Render ghost rods for this ghost plate
    if (ghostPlate.rodModifications) {
      for (const rodMod of ghostPlate.rodModifications) {
        // Render complete new rod
        const rodSKU = getRodSKU(rodMod.newSkuId!);
        if (!rodSKU) continue;

        const ghostRod: Rod = {
          sku_id: rodMod.newSkuId!,
          position: rodMod.position,
          attachmentPoints: calculateAttachmentPositions(rodSKU).map(y => ({ y }))
        };

        const meshes = createRodMeshes(ghostRod, true, ghostOpacity);
        meshes.forEach(mesh => {
          mesh.userData.type = 'ghost_rod';
          mesh.userData.ghostPlateIndex = index;
          scene.add(mesh);
        });
      }
    }
  });

  shelf.ghostRods.forEach((ghostRod, index) => {
    const ghostOpacity = 0.15;
    const meshes = createRodMeshes(ghostRod as any as Rod, true, ghostOpacity, index);
    meshes.forEach(mesh => scene.add(mesh));
  });

  // Update URL with current shelf state
  updateURLWithShelf(shelf);
}


// Update SKU list UI with pricing
function updateSKUList(shelf: Shelf, container: HTMLDivElement): void {
  let html = '<div style="font-weight: bold; margin-bottom: 10px; font-size: 14px; color: #333;">Parts List</div>';

  // Add debug and wall checkboxes
  html += '<div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">';
  html += '<label style="display: flex; align-items: center; cursor: pointer; font-size: 11px; color: #666; margin-bottom: 6px;">';
  html += `<input type="checkbox" id="debugCheckbox" ${DEBUG_SHOW_COLLIDERS ? 'checked' : ''} style="margin-right: 6px;">`;
  html += 'Debug Mode';
  html += '</label>';
  html += '<label style="display: flex; align-items: center; cursor: pointer; font-size: 11px; color: #666;">';
  html += `<input type="checkbox" id="wallCheckbox" ${DRAW_WALL ? 'checked' : ''} style="margin-right: 6px;">`;
  html += 'Show Wall';
  html += '</label>';
  html += '</div>';

  // Check if we have pricing data
  if (cachedPriceData) {
    const pricing = calculateShelfPricing(shelf, cachedPriceData);

    if (pricing.rods.length === 0 && pricing.plates.length === 0) {
      html += '<div style="font-size: 11px; color: #888; font-style: italic;">Empty shelf</div>';
    } else {
      // Start table
      html += '<table style="width: 100%; font-size: 11px; border-collapse: collapse;">';

      // Calculate total number of rod pairs for the summary
      let totalPhysicalRods = 0;

      if (pricing.rods.length > 0) {
        html += '<tr><td colspan="3" style="font-weight: bold; font-size: 11px; padding: 4px 0 4px 0; color: #555;">Rods (pairs)</td></tr>';
        pricing.rods.forEach((rod) => {
          totalPhysicalRods += rod.quantity;
          const pairs = rod.quantity / 2;
          html += `<tr style="border-bottom: 1px solid #f0f0f0;">`;
          html += `<td style="padding: 3px 8px 3px 0; color: #666;">${pairs}×</td>`;
          html += `<td style="padding: 3px 8px; text-align: left; color: #333;">${rod.name}</td>`;
          html += `<td style="padding: 3px 0 3px 8px; text-align: right; font-family: 'Courier New', monospace; color: #333;">${formatPrice(rod.totalPrice)}</td>`;
          html += `</tr>`;
        });
      }

      if (pricing.plates.length > 0) {
        html += '<tr><td colspan="3" style="font-weight: bold; font-size: 11px; padding: 8px 0 4px 0; color: #555;">Plates</td></tr>';
        pricing.plates.forEach((plate) => {
          html += `<tr style="border-bottom: 1px solid #f0f0f0;">`;
          html += `<td style="padding: 3px 8px 3px 0; color: #666;">${plate.quantity}×</td>`;
          html += `<td style="padding: 3px 8px; text-align: left; color: #333;">${plate.name}</td>`;
          html += `<td style="padding: 3px 0 3px 8px; text-align: right; font-family: 'Courier New', monospace; color: #333;">${formatPrice(plate.totalPrice)}</td>`;
          html += `</tr>`;
        });
      }

      // Support rods
      if (pricing.supportRods.quantity > 0) {
        html += '<tr><td colspan="3" style="font-weight: bold; font-size: 11px; padding: 8px 0 4px 0; color: #555;">Accessories</td></tr>';
        html += `<tr style="border-bottom: 1px solid #f0f0f0;">`;
        html += `<td style="padding: 3px 8px 3px 0; color: #666;">${pricing.supportRods.quantity}×</td>`;
        html += `<td style="padding: 3px 8px; text-align: left; color: #333;">${pricing.supportRods.name}</td>`;
        html += `<td style="padding: 3px 0 3px 8px; text-align: right; font-family: 'Courier New', monospace; color: #333;">${formatPrice(pricing.supportRods.totalPrice)}</td>`;
        html += `</tr>`;
      }

      html += '</table>';

      // Total price
      html += '<div style="margin-top: 12px; padding-top: 10px; border-top: 2px solid #333; display: flex; justify-content: space-between; align-items: center;">';
      html += '<span style="font-weight: bold; font-size: 13px; color: #333;">Total</span>';
      html += '<span style="font-weight: bold; font-size: 14px; font-family: \'Courier New\', monospace; color: #333;">' + formatPrice(pricing.totalPrice) + '</span>';
      html += '</div>';
    }
  } else {
    // Fallback to non-priced display if prices haven't loaded yet
    const rodCounts = new Map<string, number>();
    const plateCounts = new Map<string, number>();

    shelf.rods.forEach((rod) => {
      const rodSKU = getRodSKU(rod.sku_id);
      if (rodSKU) {
        rodCounts.set(rodSKU.name, (rodCounts.get(rodSKU.name) || 0) + 1);
      }
    });

    shelf.plates.forEach((plate) => {
      const plateSKU = getPlateSKU(plate.sku_id);
      if (plateSKU) {
        plateCounts.set(plateSKU.name, (plateCounts.get(plateSKU.name) || 0) + 1);
      }
    });

    if (rodCounts.size > 0) {
      html += '<div style="margin-bottom: 6px; font-weight: bold; font-size: 12px;">Rods:</div>';
      rodCounts.forEach((count, name) => {
        html += `<div style="margin-left: 8px; font-size: 11px;">${count}x ${name}</div>`;
      });
    }

    if (plateCounts.size > 0) {
      html += '<div style="margin-bottom: 6px; margin-top: 8px; font-weight: bold; font-size: 12px;">Plates:</div>';
      plateCounts.forEach((count, name) => {
        html += `<div style="margin-left: 8px; font-size: 11px;">${count}x ${name}</div>`;
      });
    }

    if (rodCounts.size === 0 && plateCounts.size === 0) {
      html += '<div style="font-size: 11px; color: #888;">Empty shelf</div>';
    }

    html += '<div style="margin-top: 8px; font-size: 10px; color: #888;">Loading prices...</div>';
  }

  container.innerHTML = html;
}

// General shelf visualizer
function visualizeShelf(shelf: Shelf): void {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xf5f5f5);
  document.body.appendChild(renderer.domElement);

  // Create SKU list container
  const skuListContainer = document.createElement('div');
  skuListContainer.style.position = 'absolute';
  skuListContainer.style.top = '10px';
  skuListContainer.style.left = '10px';
  skuListContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  skuListContainer.style.padding = '12px';
  skuListContainer.style.borderRadius = '6px';
  skuListContainer.style.fontFamily = 'monospace';
  skuListContainer.style.fontSize = '12px';
  skuListContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
  skuListContainer.style.minWidth = '150px';
  skuListContainer.style.zIndex = '1000';
  document.body.appendChild(skuListContainer);

  // Create tooltip container
  const tooltipContainer = document.createElement('div');
  tooltipContainer.style.position = 'absolute';
  tooltipContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  tooltipContainer.style.color = '#fff';
  tooltipContainer.style.padding = '8px';
  tooltipContainer.style.borderRadius = '4px';
  tooltipContainer.style.fontFamily = 'monospace';
  tooltipContainer.style.fontSize = '10px';
  tooltipContainer.style.pointerEvents = 'none';
  tooltipContainer.style.display = 'none';
  tooltipContainer.style.zIndex = '2000';
  tooltipContainer.style.maxWidth = '400px';
  tooltipContainer.style.whiteSpace = 'pre-wrap';
  document.body.appendChild(tooltipContainer);

  // Modal helper functions
  function createModal(title: string): { overlay: HTMLDivElement, content: HTMLDivElement, close: () => void } {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const content = document.createElement('div');
    content.style.backgroundColor = 'white';
    content.style.padding = '20px';
    content.style.borderRadius = '8px';
    content.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
    content.style.maxWidth = '600px';
    content.style.width = '90%';
    content.style.position = 'relative';

    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.style.margin = '0 0 15px 0';
    titleElement.style.fontFamily = 'monospace';
    titleElement.style.fontSize = '16px';

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.border = 'none';
    closeButton.style.background = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = '#666';

    content.appendChild(closeButton);
    content.appendChild(titleElement);
    overlay.appendChild(content);

    const close = () => {
      document.body.removeChild(overlay);
    };

    closeButton.onclick = close;
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };

    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escapeHandler);
      }
    });

    document.body.appendChild(overlay);

    return { overlay, content, close };
  }

  function showExportModal(shelf: Shelf): void {
    const jsonString = encodeShelfToJSON(shelf);
    const { content, close } = createModal('Export Shelf Configuration');

    const instruction = document.createElement('p');
    instruction.textContent = 'Copy this code to save your shelf:';
    instruction.style.margin = '0 0 10px 0';
    instruction.style.fontFamily = 'monospace';
    instruction.style.fontSize = '12px';
    content.appendChild(instruction);

    const textarea = document.createElement('textarea');
    textarea.value = jsonString;
    textarea.readOnly = true;
    textarea.style.width = '100%';
    textarea.style.height = '150px';
    textarea.style.fontFamily = 'monospace';
    textarea.style.fontSize = '11px';
    textarea.style.padding = '8px';
    textarea.style.border = '1px solid #ccc';
    textarea.style.borderRadius = '4px';
    textarea.style.resize = 'vertical';
    textarea.style.boxSizing = 'border-box';
    content.appendChild(textarea);

    textarea.select();
    textarea.focus();

    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '15px';
    buttonContainer.style.textAlign = 'center';
    content.appendChild(buttonContainer);

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy to Clipboard';
    copyButton.style.padding = '8px 16px';
    copyButton.style.border = '1px solid #ccc';
    copyButton.style.borderRadius = '4px';
    copyButton.style.backgroundColor = '#007bff';
    copyButton.style.color = 'white';
    copyButton.style.cursor = 'pointer';
    copyButton.style.fontFamily = 'monospace';
    copyButton.style.fontSize = '12px';
    buttonContainer.appendChild(copyButton);

    copyButton.onclick = async () => {
      try {
        await navigator.clipboard.writeText(jsonString);
        copyButton.textContent = '✓ Copied!';
        copyButton.style.backgroundColor = '#28a745';
        setTimeout(() => {
          copyButton.textContent = 'Copy to Clipboard';
          copyButton.style.backgroundColor = '#007bff';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        copyButton.textContent = '✗ Failed';
        copyButton.style.backgroundColor = '#dc3545';
      }
    };
  }

  function showImportModal(shelf: Shelf, rebuildCallback: () => void): void {
    const { content, close } = createModal('Import Shelf Configuration');

    const instruction = document.createElement('p');
    instruction.textContent = 'Paste your shelf code here:';
    instruction.style.margin = '0 0 10px 0';
    instruction.style.fontFamily = 'monospace';
    instruction.style.fontSize = '12px';
    content.appendChild(instruction);

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Paste encoded shelf string...';
    textarea.style.width = '100%';
    textarea.style.height = '150px';
    textarea.style.fontFamily = 'monospace';
    textarea.style.fontSize = '11px';
    textarea.style.padding = '8px';
    textarea.style.border = '1px solid #ccc';
    textarea.style.borderRadius = '4px';
    textarea.style.resize = 'vertical';
    textarea.style.boxSizing = 'border-box';
    content.appendChild(textarea);

    textarea.focus();

    const errorMessage = document.createElement('p');
    errorMessage.style.color = '#dc3545';
    errorMessage.style.fontFamily = 'monospace';
    errorMessage.style.fontSize = '11px';
    errorMessage.style.margin = '10px 0 0 0';
    errorMessage.style.display = 'none';
    content.appendChild(errorMessage);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '15px';
    buttonContainer.style.textAlign = 'center';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.justifyContent = 'center';
    content.appendChild(buttonContainer);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '8px 16px';
    cancelButton.style.border = '1px solid #ccc';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.backgroundColor = '#fff';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.fontFamily = 'monospace';
    cancelButton.style.fontSize = '12px';
    buttonContainer.appendChild(cancelButton);

    const importButton = document.createElement('button');
    importButton.textContent = 'Import';
    importButton.style.padding = '8px 16px';
    importButton.style.border = '1px solid #ccc';
    importButton.style.borderRadius = '4px';
    importButton.style.backgroundColor = '#28a745';
    importButton.style.color = 'white';
    importButton.style.cursor = 'pointer';
    importButton.style.fontFamily = 'monospace';
    importButton.style.fontSize = '12px';
    buttonContainer.appendChild(importButton);

    cancelButton.onclick = close;

    importButton.onclick = () => {
      const jsonString = textarea.value.trim();
      if (!jsonString) {
        errorMessage.textContent = 'Please paste a shelf code';
        errorMessage.style.display = 'block';
        return;
      }

      try {
        const importedShelf = decodeShelfFromJSON(jsonString);
        // Clear current shelf and copy imported data
        shelf.rods.clear();
        shelf.plates.clear();
        shelf.ghostPlates = [];
        shelf.metadata.nextId = importedShelf.metadata.nextId;
        importedShelf.rods.forEach((rod, id) => shelf.rods.set(id, rod));
        importedShelf.plates.forEach((plate, id) => shelf.plates.set(id, plate));
        shelf.ghostPlates = importedShelf.ghostPlates;

        rebuildCallback();
        close();
      } catch (err) {
        errorMessage.textContent = `Invalid shelf code: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errorMessage.style.display = 'block';
      }
    };
  }

  // Create undo/redo button container
  const undoRedoContainer = document.createElement('div');
  undoRedoContainer.style.position = 'absolute';
  undoRedoContainer.style.bottom = '10px';
  undoRedoContainer.style.left = '10px';
  undoRedoContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  undoRedoContainer.style.padding = '8px';
  undoRedoContainer.style.borderRadius = '6px';
  undoRedoContainer.style.fontFamily = 'monospace';
  undoRedoContainer.style.fontSize = '12px';
  undoRedoContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
  undoRedoContainer.style.display = 'flex';
  undoRedoContainer.style.gap = '8px';
  undoRedoContainer.style.zIndex = '1000';
  document.body.appendChild(undoRedoContainer);

  // Create undo button
  const undoButton = document.createElement('button');
  undoButton.textContent = '↶ Undo';
  undoButton.style.padding = '6px 12px';
  undoButton.style.border = '1px solid #ccc';
  undoButton.style.borderRadius = '4px';
  undoButton.style.backgroundColor = '#fff';
  undoButton.style.cursor = 'pointer';
  undoButton.style.fontFamily = 'monospace';
  undoButton.style.fontSize = '11px';
  undoButton.title = 'Undo (Ctrl+Z)';
  undoRedoContainer.appendChild(undoButton);

  // Create redo button
  const redoButton = document.createElement('button');
  redoButton.textContent = '↷ Redo';
  redoButton.style.padding = '6px 12px';
  redoButton.style.border = '1px solid #ccc';
  redoButton.style.borderRadius = '4px';
  redoButton.style.backgroundColor = '#fff';
  redoButton.style.cursor = 'pointer';
  redoButton.style.fontFamily = 'monospace';
  redoButton.style.fontSize = '11px';
  redoButton.title = 'Redo (Ctrl+Shift+Z)';
  undoRedoContainer.appendChild(redoButton);

  // Create export button
  const exportButton = document.createElement('button');
  exportButton.textContent = '💾 Export';
  exportButton.style.padding = '6px 12px';
  exportButton.style.border = '1px solid #ccc';
  exportButton.style.borderRadius = '4px';
  exportButton.style.backgroundColor = '#fff';
  exportButton.style.cursor = 'pointer';
  exportButton.style.fontFamily = 'monospace';
  exportButton.style.fontSize = '11px';
  exportButton.title = 'Export shelf configuration';
  undoRedoContainer.appendChild(exportButton);

  // Create import button
  const importButton = document.createElement('button');
  importButton.textContent = '📥 Import';
  importButton.style.padding = '6px 12px';
  importButton.style.border = '1px solid #ccc';
  importButton.style.borderRadius = '4px';
  importButton.style.backgroundColor = '#fff';
  importButton.style.cursor = 'pointer';
  importButton.style.fontFamily = 'monospace';
  importButton.style.fontSize = '11px';
  importButton.title = 'Import shelf configuration';
  undoRedoContainer.appendChild(importButton);

  // Create reset button
  const resetButton = document.createElement('button');
  resetButton.textContent = '🔄 Reset';
  resetButton.style.padding = '6px 12px';
  resetButton.style.border = '1px solid #ccc';
  resetButton.style.borderRadius = '4px';
  resetButton.style.backgroundColor = '#fff';
  resetButton.style.cursor = 'pointer';
  resetButton.style.fontFamily = 'monospace';
  resetButton.style.fontSize = '11px';
  resetButton.title = 'Reset to default shelf';
  undoRedoContainer.appendChild(resetButton);

  // Wire up export/import button handlers
  exportButton.onclick = () => {
    showExportModal(shelf);
  };

  importButton.onclick = () => {
    showImportModal(shelf, () => {
      rebuildShelfGeometry(shelf, scene, skuListContainer);
    });
  };

  resetButton.onclick = () => {
    // Create default shelf
    const defaultShelf = createDefaultShelf();

    // Clear current shelf
    shelf.rods.clear();
    shelf.plates.clear();
    shelf.ghostPlates = [];

    // Copy default shelf data
    shelf.metadata.nextId = defaultShelf.metadata.nextId;
    defaultShelf.rods.forEach((rod, id) => shelf.rods.set(id, rod));
    defaultShelf.plates.forEach((plate, id) => shelf.plates.set(id, plate));
    shelf.ghostPlates = defaultShelf.ghostPlates;

    // Rebuild visualization
    rebuildShelfGeometry(shelf, scene, skuListContainer);
    setupDebugCheckbox();
    updateUndoRedoButtons();
  };

  // Setup debug and wall checkbox event listeners
  const setupDebugCheckbox = () => {
    const debugCheckbox = document.getElementById('debugCheckbox') as HTMLInputElement;
    if (debugCheckbox) {
      debugCheckbox.addEventListener('change', (e) => {
        DEBUG_SHOW_COLLIDERS = (e.target as HTMLInputElement).checked;
        rebuildShelfGeometry(shelf, scene, skuListContainer);
        setupDebugCheckbox(); // Re-attach after rebuild recreates checkboxes
      });
    }

    const wallCheckbox = document.getElementById('wallCheckbox') as HTMLInputElement;
    if (wallCheckbox) {
      wallCheckbox.addEventListener('change', (e) => {
        DRAW_WALL = (e.target as HTMLInputElement).checked;
        rebuildShelfGeometry(shelf, scene, skuListContainer);
        setupDebugCheckbox(); // Re-attach after rebuild recreates checkboxes
      });
    }
  };

  // Initial geometry rendering (this calls updateSKUList which creates the checkbox)
  rebuildShelfGeometry(shelf, scene, skuListContainer);
  setupDebugCheckbox();

  // Calculate shelf center for camera target
  const rods = Array.from(shelf.rods.values());
  const xPositions = rods.map(rod => rod.position.x);
  const yPositions = rods.map(rod => rod.position.y);
  const minX = Math.min(...xPositions);
  const maxX = Math.max(...xPositions);
  const minY = Math.min(...yPositions);
  const maxY = Math.max(...yPositions);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2 + 150; // Add typical shelf height

  // Set up OrbitControls
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableRotate = true;

  // Set camera target to shelf center
  controls.target.set(centerX, centerY, 100);

  // Position camera for wall-mounted shelf view (looking at XY plane from positive Z)
  // Camera is higher and further back, looking down at the shelf
  const shelfWidth = maxX - minX;
  const shelfHeight = maxY - minY + 300; // Add rod height
  const cameraDistance = Math.max(shelfWidth, shelfHeight) * 0.8 + 800;
  camera.position.set(centerX, centerY + 400, cameraDistance);
  controls.update();

  // Setup interactions with regeneration callback
  const interactions = setupInteractions(
    shelf,
    scene,
    camera,
    renderer,
    {
      rebuildGeometry: () => {
        rebuildShelfGeometry(shelf, scene, skuListContainer);
        setupDebugCheckbox();
        updateUndoRedoButtons();
      }
    },
    tooltipContainer
  );

  // Function to update undo/redo button states
  function updateUndoRedoButtons() {
    const undoManager = interactions.undoManager;

    // Update undo button
    if (undoManager.canUndo()) {
      undoButton.disabled = false;
      undoButton.style.opacity = '1';
      undoButton.style.cursor = 'pointer';
    } else {
      undoButton.disabled = true;
      undoButton.style.opacity = '0.5';
      undoButton.style.cursor = 'not-allowed';
    }

    // Update redo button
    if (undoManager.canRedo()) {
      redoButton.disabled = false;
      redoButton.style.opacity = '1';
      redoButton.style.cursor = 'pointer';
    } else {
      redoButton.disabled = true;
      redoButton.style.opacity = '0.5';
      redoButton.style.cursor = 'not-allowed';
    }
  }

  // Setup button event listeners
  undoButton.addEventListener('click', () => {
    if (interactions.undoManager.undo()) {
      console.log('Undo successful');
    }
  });

  redoButton.addEventListener('click', () => {
    if (interactions.undoManager.redo()) {
      console.log('Redo successful');
    }
  });

  // Initial button state update
  updateUndoRedoButtons();

  // Handle window resize
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onWindowResize);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

/**
 * Update the browser URL with the current shelf state.
 */
function updateURLWithShelf(shelf: Shelf): void {
  try {
    const encoded = encodeShelf(shelf);
    const url = new URL(window.location.href);
    url.searchParams.set('shelf', encoded);
    window.history.replaceState({}, '', url.toString());
  } catch (error) {
    console.error('Failed to update URL:', error);
  }
}

/**
 * Load shelf from URL parameter if available.
 * Returns the loaded shelf or null if no URL parameter exists.
 */
function loadShelfFromURL(): Shelf | null {
  try {
    const url = new URL(window.location.href);
    const encoded = url.searchParams.get('shelf');
    if (!encoded) return null;

    const shelf = decodeShelf(encoded);
    // Check if shelf has any content
    if (shelf.rods.size === 0) return null;

    return shelf;
  } catch (error) {
    console.error('Failed to load shelf from URL:', error);
    return null;
  }
}

/**
 * Create a default demo shelf.
 */
function createDefaultShelf(): Shelf {
  const shelf = createEmptyShelf();

  const rod1 = addRod({ x: 0, y: 0 }, 4, shelf); // 3P_22: 3 attachment points, 200mm + 200mm gaps
  const rod2 = addRod({ x: 600, y: 0 }, 4, shelf); // 3P_22: matching rod

  addPlate(0, 1, [rod1, rod2], shelf);
  addPlate(200, 1, [rod1, rod2], shelf);
  addPlate(400, 1, [rod1, rod2], shelf);

  return shelf;
}

// Initialize the application
async function init() {
  // Load prices first
  try {
    cachedPriceData = await loadPrices();
    console.log('Prices loaded successfully');
  } catch (error) {
    console.error('Failed to load prices:', error);
    // Continue without pricing - will show fallback UI
  }

  // Try to load from URL, otherwise create default shelf
  let shelf = loadShelfFromURL();
  if (!shelf) {
    shelf = createDefaultShelf();
  }

  // Update URL with current shelf state
  updateURLWithShelf(shelf);

  visualizeShelf(shelf);
}

// Start the application
init();