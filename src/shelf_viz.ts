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

  // Update SKU list if container is provided
  if (skuListContainer) {
    updateSKUList(shelf, skuListContainer);
  }

  // Generate rod geometry (each logical rod is two physical rods)
  shelf.rods.forEach((rod, rodId) => {
    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    const height = rodSKU?.spans.reduce((sum, span) => sum + span, 0) || 40;

    // Plate depth is 200mm, rods are at the front (Z=0) and back (Z=200) edges
    const plateDepth = 200;
    const zPositions = [0, plateDepth];

    // Create two rods - one at front, one at back
    zPositions.forEach(zPos => {
      const rodMaterial = new THREE.MeshStandardMaterial({ color: 0x887668, roughness: 0.7, metalness: 0.0 });

      // Main cylinder body
      const rodMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(14, 14, height, 16, 1, false),
        rodMaterial
      );
      rodMesh.position.set(rod.position.x, rod.position.y + height / 2, zPos);
      rodMesh.userData = { type: 'rod', rodId: rodId };
      scene.add(rodMesh);

      // Add rounded caps at top and bottom
      const capRadius = 14;
      const topCap = new THREE.Mesh(
        new THREE.SphereGeometry(capRadius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        rodMaterial
      );
      topCap.position.set(rod.position.x, rod.position.y + height, zPos);
      scene.add(topCap);

      const bottomCap = new THREE.Mesh(
        new THREE.SphereGeometry(capRadius, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        rodMaterial
      );
      bottomCap.position.set(rod.position.x, rod.position.y, zPos);
      scene.add(bottomCap);
    });

    // Add horizontal connecting rods between front and back vertical rods at attachment points
    rod.attachmentPoints.forEach(ap => {
      const attachmentY = rod.position.y + ap.y;
      const hasPlate = ap.plateId !== undefined;

      if (hasPlate) {
        // Connection rod diameter ~8-10mm, runs full depth (200mm)
        const connectionRodRadius = 5;
        const connectionRodMaterial = new THREE.MeshStandardMaterial({
          color: 0x887668,
          roughness: 0.7,
          metalness: 0.0
        });

        // Horizontal cylinder connecting front (Z=0) to back (Z=200)
        const connectionRod = new THREE.Mesh(
          new THREE.CylinderGeometry(connectionRodRadius, connectionRodRadius, plateDepth, 16),
          connectionRodMaterial
        );

        // Rotate to align with Z-axis (default cylinder is along Y-axis)
        connectionRod.rotation.x = Math.PI / 2;

        // Position at the attachment point, centered in Z
        connectionRod.position.set(rod.position.x, attachmentY, plateDepth / 2);
        connectionRod.userData = { type: 'connection_rod' };
        scene.add(connectionRod);
      }
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
      new THREE.BoxGeometry(plateWidth, 30, plateSKU.depth),
      new THREE.MeshStandardMaterial({ color: 0x988373, roughness: 0.7, metalness: 0.0 })
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

addPlate(200, 1, [rod1, rod2], shelf); // 670mm plate at middle attachment level

visualizeShelf(shelf);