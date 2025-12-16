// Import functions from shelf-model.ts
import {
  createEmptyShelf,
  addRod,
  addPlate,
  AVAILABLE_RODS,
  AVAILABLE_PLATES,
  calculateAttachmentPositions,
  regenerateGhostPlates,
  type Shelf,
  type Rod
} from './shelf-model.js';

import { setupInteractions } from './interactions.js';

// Declare THREE as global (loaded via CDN)
declare const THREE: any;

// Debug state to make colliders visible
export let DEBUG_SHOW_COLLIDERS = false;

// Distance (in mm) between the two rods holding a plate
const rodDistance = 153

const rodRadius = 14
const plateThickness = 20
const connectionRodRadius = 6
const innerRodHeightPadding = 65
const outerRodHeightPadding = 35
const connectionRodGrooveDepth = 4

/**
 * Creates all meshes for a single logical rod (inner rod, outer rod, and connection rods).
 * @param rod - The rod data from shelf model
 * @param isGhost - Whether to render as ghost (transparent green) or normal
 * @returns Array of THREE.Mesh objects to add to scene
 */
function createRodMeshes(rod: Rod, isGhost: boolean): any[] {
  const meshes: any[] = [];

  const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  const height = rodSKU?.spans.reduce((sum, span) => sum + span, 0) || 0;

  // Determine material based on ghost/normal mode
  const rodMaterial = isGhost
    ? new THREE.MeshBasicMaterial({
      color: 0x90EE90, // Light green
      transparent: true,
      opacity: DEBUG_SHOW_COLLIDERS ? 0.3 : 0.0 // Will be set to 0.5 on hover
    })
    : new THREE.MeshStandardMaterial({
      color: 0x76685e,
      roughness: 0.7,
      metalness: 0.0
    });

  // [bool innerRod, radius]. The inner rod is the one attached to the wall
  const zPositions = [[true, rodRadius], [false, rodDistance + rodRadius]];

  // Create two rods - one at front, one at back
  zPositions.forEach(([innerRod, zPos]) => {
    const rodPadding = innerRod ? innerRodHeightPadding : outerRodHeightPadding;
    const rodHeight = height + rodPadding * 2 + plateThickness;

    // Main cylinder body
    const rodRadialSegments = 32;
    const rodGeometry = new THREE.CylinderGeometry(rodRadius, rodRadius, rodHeight, rodRadialSegments, 1, false);
    rodGeometry.computeVertexNormals();
    const rodMesh = new THREE.Mesh(rodGeometry, rodMaterial.clone());
    rodMesh.position.set(rod.position.x, rod.position.y + rodHeight / 2 - rodPadding - plateThickness / 2, zPos);
    rodMesh.userData = { type: isGhost ? 'ghost_rod' : 'rod' };

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
        opacity: DEBUG_SHOW_COLLIDERS ? 0.3 : 0.0 // Will be set to 0.5 on hover
      })
      : new THREE.MeshStandardMaterial({
        color: 0x76685e,
        roughness: 0.7,
        metalness: 0.0
      });

    let connectionRodLength = 202;

    // Horizontal cylinder connecting front (Z=0) to back (Z=200)
    const connectionRodGeometry = new THREE.CylinderGeometry(connectionRodRadius, connectionRodRadius, connectionRodLength, 16);
    connectionRodGeometry.computeVertexNormals();
    const connectionRod = new THREE.Mesh(connectionRodGeometry, connectionRodMaterial);

    // Rotate to align with Z-axis (default cylinder is along Y-axis)
    connectionRod.rotation.x = Math.PI / 2;

    // Position at the attachment point, centered in Z
    connectionRod.position.set(rod.position.x, attachmentY, connectionRodLength / 2);
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
  const wallWidth = 10000; // 10m wide
  const wallHeight = 3140; // >3m tall
  const minX = -5000;
  const maxX = minX + wallWidth;
  const minY = -1500;
  const maxY = minY + wallHeight;

  const wallZ = -10; // Position wall slightly behind the inner rods

  // Grid spacing constants
  const smallGridSpacing = 200; // 20cm in mm
  const largeGridSpacing = 600; // 60cm in mm

  // Create vertical lines using meshes for better antialiasing
  for (let x = Math.floor(minX / smallGridSpacing) * smallGridSpacing; x <= maxX; x += smallGridSpacing) {
    const isThickLine = Math.abs(x % largeGridSpacing) < 0.1;
    const lineWidth = isThickLine ? 3 : 1;
    const lineColor = isThickLine ? 0x999999 : 0xdddddd;
    const lineOpacity = isThickLine ? 0.8 : 0.5;

    const lineGeometry = new THREE.PlaneGeometry(lineWidth, wallHeight);
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: lineOpacity,
      side: THREE.DoubleSide
    });

    const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
    lineMesh.position.set(x, (minY + maxY) / 2, wallZ + 0.5);
    lineMesh.userData = { type: 'wall_grid' };
    scene.add(lineMesh);
  }

  // Create horizontal lines using meshes
  for (let y = Math.floor(minY / smallGridSpacing) * smallGridSpacing; y <= maxY; y += smallGridSpacing) {
    const isThickLine = Math.abs(y % largeGridSpacing) < 0.1;
    const lineWidth = isThickLine ? 3 : 1;
    const lineColor = isThickLine ? 0x999999 : 0xdddddd;
    const lineOpacity = isThickLine ? 0.8 : 0.5;

    const lineGeometry = new THREE.PlaneGeometry(wallWidth, lineWidth);
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: lineOpacity,
      side: THREE.DoubleSide
    });

    const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
    lineMesh.position.set((minX + maxX) / 2, y, wallZ + 0.5);
    lineMesh.userData = { type: 'wall_grid' };
    scene.add(lineMesh);
  }

  // Calculate bottom of shelf for label positioning
  let shelfBottomY = 0;
  if (rods.length > 0) {
    const yPositions = rods.map(rod => rod.position.y);
    shelfBottomY = Math.min(...yPositions);
  }

  // Add labels on 60cm vertical lines underneath the shelf bottom
  const labelY = shelfBottomY - 60; // Position 60mm below shelf bottom
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

  // Add a solid wall background plane
  const wallGeometry = new THREE.PlaneGeometry(wallWidth, wallHeight);
  const wallMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    opacity: 0.95,
    transparent: true
  });

  const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
  wallMesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, wallZ - 1);
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
  createWallGrid(scene, shelf);

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
    const meshes = createRodMeshes(rod, false);
    meshes.forEach(mesh => {
      mesh.userData.rodId = rodId; // Ensure rodId is set for interactions
      scene.add(mesh);
    });
  });

  // Generate plate geometry
  shelf.plates.forEach((plate, plateId) => {
    const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
    if (!plateSKU) return;

    const plateWidth = plateSKU.spans.reduce((sum, span) => sum + span, 0);

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

  shelf.ghostPlates.forEach((ghostPlate, index) => {
    const segmentWidth = ghostPlate.width || 600;
    const centerX = ghostPlate.midpointPosition.x;

    let ghostColor = 0x90EE90; // Light green for legal
    if (!ghostPlate.legal) {
      ghostColor = 0xff0000; // Red for illegal
    }

    const ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(segmentWidth, 30, 200),
      new THREE.MeshBasicMaterial({
        color: ghostColor,
        transparent: true,
        opacity: DEBUG_SHOW_COLLIDERS ? 0.3 : 0.0,
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
        if (rodMod.type === 'create') {
          // Render complete new rod
          const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rodMod.newSkuId);
          if (!rodSKU) continue;

          const ghostRod: Rod = {
            sku_id: rodMod.newSkuId!,
            position: rodMod.position,
            attachmentPoints: calculateAttachmentPositions(rodSKU).map(y => ({ y }))
          };

          const meshes = createRodMeshes(ghostRod, true);
          meshes.forEach(mesh => {
            mesh.userData.type = 'ghost_rod';
            mesh.userData.ghostPlateIndex = index;
            scene.add(mesh);
          });

        } else if (rodMod.type === 'extend') {
          // Render only the extension segment
          const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rodMod.newSkuId);
          if (!rodSKU) continue;

          const visualHeight = rodMod.visualHeight!;
          const visualY = rodMod.visualY!;

          // Create a temporary rod object for the extension segment only
          // We'll render cylinders manually for just the new segment
          const ghostRodRadius = rodRadius - 1; // Slightly smaller to fit inside real rod

          // Create ghost material
          const ghostMaterial = new THREE.MeshBasicMaterial({
            color: 0x90EE90, // Light green
            transparent: true,
            opacity: DEBUG_SHOW_COLLIDERS ? 0.3 : 0.0
          });

          // Render inner and outer extension segments
          const zPositions = [[true, ghostRodRadius], [false, rodDistance + ghostRodRadius]];

          zPositions.forEach(([innerRod, zPos]) => {
            const rodPadding = innerRod ? innerRodHeightPadding : outerRodHeightPadding;
            const segmentHeight = visualHeight + (innerRod ? rodPadding * 2 : rodPadding * 2) + plateThickness;

            const rodGeometry = new THREE.CylinderGeometry(ghostRodRadius, ghostRodRadius, segmentHeight, 32);
            rodGeometry.computeVertexNormals();
            const rodMesh = new THREE.Mesh(rodGeometry, ghostMaterial.clone());

            // Position the segment at the visualY location
            rodMesh.position.set(
              rodMod.position.x,
              visualY + segmentHeight / 2 - rodPadding - plateThickness / 2,
              zPos
            );

            rodMesh.userData = {
              type: 'ghost_rod',
              ghostPlateIndex: index,
              rodModType: 'extend'
            };

            scene.add(rodMesh);
          });

          // Add connection rod at the new attachment point (if extending upward)
          // For simplicity, we'll add it at the visualY position
          const connectionMaterial = new THREE.MeshBasicMaterial({
            color: 0x90EE90,
            transparent: true,
            opacity: DEBUG_SHOW_COLLIDERS ? 0.3 : 0.0
          });

          const connectionRodLength = 202;
          const connectionGeometry = new THREE.CylinderGeometry(
            connectionRodRadius,
            connectionRodRadius,
            connectionRodLength,
            16
          );
          connectionGeometry.computeVertexNormals();
          const connectionRod = new THREE.Mesh(connectionGeometry, connectionMaterial);
          connectionRod.rotation.x = Math.PI / 2;
          connectionRod.position.set(
            rodMod.position.x,
            visualY - plateThickness / 2 - connectionRodRadius + connectionRodGrooveDepth,
            connectionRodLength / 2
          );
          connectionRod.userData = {
            type: 'ghost_connection_rod',
            ghostPlateIndex: index
          };
          scene.add(connectionRod);

        } else if (rodMod.type === 'merge') {
          // For merge, render the complete merged rod
          const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rodMod.newSkuId);
          if (!rodSKU) continue;

          // We need to figure out the position of the merged rod
          // It will be at the same X as the existing rods, but we need the Y position
          // For now, we'll use the position from the modification
          const ghostRod: Rod = {
            sku_id: rodMod.newSkuId!,
            position: rodMod.position,
            attachmentPoints: calculateAttachmentPositions(rodSKU).map(y => ({ y }))
          };

          const meshes = createRodMeshes(ghostRod, true);
          meshes.forEach(mesh => {
            mesh.userData.type = 'ghost_rod';
            mesh.userData.ghostPlateIndex = index;
            mesh.userData.rodModType = 'merge';
            scene.add(mesh);
          });
        }
      }
    }
  });
}


// Update SKU list UI
function updateSKUList(shelf: Shelf, container: HTMLDivElement): void {
  const rodCounts = new Map<string, number>();
  const plateCounts = new Map<string, number>();

  shelf.rods.forEach((rod) => {
    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    if (rodSKU) {
      rodCounts.set(rodSKU.name, (rodCounts.get(rodSKU.name) || 0) + 1);
    }
  });

  shelf.plates.forEach((plate) => {
    const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
    if (plateSKU) {
      plateCounts.set(plateSKU.name, (plateCounts.get(plateSKU.name) || 0) + 1);
    }
  });

  let html = '<div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">SKU List</div>';

  // Add debug checkbox
  html += '<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #ccc;">';
  html += '<label style="display: flex; align-items: center; cursor: pointer; font-size: 11px;">';
  html += `<input type="checkbox" id="debugCheckbox" ${DEBUG_SHOW_COLLIDERS ? 'checked' : ''} style="margin-right: 6px;">`;
  html += 'Debug Mode';
  html += '</label>';
  html += '</div>';

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

  // Setup debug checkbox event listener
  const setupDebugCheckbox = () => {
    const checkbox = document.getElementById('debugCheckbox') as HTMLInputElement;
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        DEBUG_SHOW_COLLIDERS = (e.target as HTMLInputElement).checked;
        rebuildShelfGeometry(shelf, scene, skuListContainer);
        setupDebugCheckbox(); // Re-attach after rebuild recreates checkbox
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
      }
    },
    tooltipContainer
  );

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

// Create and display a simple default shelf
const shelf = createEmptyShelf();

const rod1 = addRod({ x: 0, y: 0 }, 4, shelf); // 3P_22: 3 attachment points, 200mm + 200mm gaps
const rod2 = addRod({ x: 600, y: 0 }, 4, shelf); // 3P_22: matching rod

addPlate(0, 1, [rod1, rod2], shelf);
addPlate(200, 1, [rod1, rod2], shelf);
addPlate(400, 1, [rod1, rod2], shelf);

visualizeShelf(shelf);