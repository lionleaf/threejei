import { type Shelf, removePlate, removeSegmentFromPlate, removeRodSegment, addPlate, addRod, type Plate, type Rod, calculateAttachmentPositions, mergePlates, extendPlate, Direction, type PlateSegmentResult, GhostPlate, GhostRod, resolveRodConnections, extendRodUp, extendRodDown, mergeRods, getRodSKU, getPlateSKU } from './shelf-model.js';
import { getDebugMode } from './shelf_viz.js';
import { UndoManager } from './undo-manager.js';

// Declare THREE as global (loaded via CDN)
declare const THREE: any;

export interface InteractionSystem {
  dispose(): void;
  undoManager: UndoManager;
}

export interface RegenerationCallbacks {
  rebuildGeometry: () => void;
}

export function setupInteractions(
  shelf: Shelf,
  scene: any,
  camera: any,
  renderer: any,
  callbacks: RegenerationCallbacks,
  tooltipContainer?: HTMLDivElement
): InteractionSystem {
  // Raycasting setup
  const raycaster = new THREE.Raycaster();

  // Initialize undo manager
  const undoManager = new UndoManager(shelf, callbacks.rebuildGeometry);

  // Save initial state
  undoManager.saveState('initial');

  function calculatePlateSegmentIndex(plate: Plate, hitX: number): number {
    const rods = plate.connections.map(id => shelf.rods.get(id)).filter(r => r !== undefined);

    for (let i = 0; i < rods.length - 1; i++) {
      const leftX = rods[i]!.position.x;
      const rightX = rods[i + 1]!.position.x;

      if (hitX >= leftX && hitX <= rightX) {
        return i;
      }
    }

    return 0; // Fallback to first segment
  }

  function calculateRodSegmentIndex(rodId: number, hitY: number): number {
    const rod = shelf.rods.get(rodId);
    if (!rod) return 0;

    const rodSKU = getRodSKU(rod.sku_id);
    if (!rodSKU) return 0;

    const attachmentPositions = calculateAttachmentPositions(rodSKU);

    // Find which segment (span) the hit Y falls into
    for (let i = 0; i < attachmentPositions.length - 1; i++) {
      const bottomY = rod.position.y + attachmentPositions[i];
      const topY = rod.position.y + attachmentPositions[i + 1];

      if (hitY >= bottomY && hitY <= topY) {
        return i; // This is the segment index
      }
    }

    return 0; // Fallback
  }

  function onRodClick(rodId: number, hitPoint?: THREE.Vector3) {
    console.log(`Removing segment from rod ${rodId}`);

    const segmentIndex = hitPoint ? calculateRodSegmentIndex(rodId, hitPoint.y) : 0;

    const success = removeRodSegment(rodId, segmentIndex, shelf);

    if (success) {
      console.log(`Rod segment removed successfully`);
      undoManager.saveState('removeRodSegment');
      callbacks.rebuildGeometry();
    } else {
      console.log(`Failed to remove rod segment`);
    }
  }

  function onPlateClick(plateId: number, hitPoint?: THREE.Vector3) {
    console.log(`Removing segment from plate ${plateId}`);

    const plate = shelf.plates.get(plateId);
    if (!plate) {
      console.log('Plate not found');
      return;
    }

    const segmentIndex = hitPoint ? calculatePlateSegmentIndex(plate, hitPoint.x) : 0;
    const success = removeSegmentFromPlate(plateId, segmentIndex, shelf);

    if (success) {
      console.log(`Plate segment removed successfully`);
      undoManager.saveState('removePlateSegment');
      callbacks.rebuildGeometry();
    } else {
      console.log(`Failed to remove plate segment`);
    }
  }

  function onGhostPlateClick(ghostPlate: GhostPlate) {
    if (!ghostPlate.legal) {
      console.log('Cannot add plate here - illegal placement');
      return;
    }

    if (!ghostPlate.sku_id || !ghostPlate.connections) {
      console.log('Ghost plate missing required data');
      return;
    }

    const action = ghostPlate.action || 'error';
    console.log(`Ghost plate action: ${action}, sku_id=${ghostPlate.sku_id}, connections=${ghostPlate.connections}`);

    // Apply rod modifications first (if any)
    if (ghostPlate.rodModifications) {
      for (const rodMod of ghostPlate.rodModifications) {
        if (rodMod.type === 'create') {
          // Create new rod
          addRod(rodMod.position, rodMod.newSkuId!, shelf);
        } else if (rodMod.type === 'extend') {
          // Extend existing rod using pre-validated direction
          const rodId = rodMod.affectedRodIds![0];
          const rod = shelf.rods.get(rodId);
          if (!rod) {
            console.error(`Rod ${rodId} not found for extension`);
            continue;
          }

          // Use the direction stored in the rod modification
          const direction = rodMod.direction!;

          if (direction === 'up') {
            extendRodUp(rodId, rodMod.newSkuId!, shelf);
          } else {
            extendRodDown(rodId, rodMod.newSkuId!, shelf);
          }
        } else if (rodMod.type === 'merge') {
          // Merge rods
          const [bottomRodId, topRodId] = rodMod.affectedRodIds!;
          mergeRods(bottomRodId, topRodId, rodMod.newSkuId!, shelf);
        }
      }
    }

    // Now handle the plate action
    let success = false;

    if (action === 'merge') {
      console.log('Executing merge action');
      if (ghostPlate.existingPlateId !== undefined &&
          ghostPlate.targetPlateId !== undefined &&
          ghostPlate.sku_id !== undefined &&
          ghostPlate.connections) {
        const mergedPlateId = mergePlates(
          ghostPlate.existingPlateId,
          ghostPlate.targetPlateId,
          ghostPlate.sku_id,
          ghostPlate.connections,
          shelf
        );
        success = mergedPlateId !== -1;
        if (success) {
          console.log(`Successfully merged into plate ${mergedPlateId}`);
        }
      }
    } else if (action === 'extend') {
      console.log('Executing extend action', ghostPlate);
      if (ghostPlate.existingPlateId !== undefined && ghostPlate.connections) {
        // Connections are already resolved (no -1 placeholders)
        extendPlate(ghostPlate.existingPlateId, ghostPlate.sku_id, ghostPlate.connections, shelf);
        success = true;
      }
    } else if (action === 'extend_rod') {
      console.log('Executing extend_rod action', ghostPlate);
      // Rod extensions already applied above via rodModifications
      // Just add the plate
      const plateId = addPlate(ghostPlate.midpointPosition.y, ghostPlate.sku_id, ghostPlate.connections, shelf);
      success = plateId !== -1;
      if (success) {
        console.log(`Successfully extended rods and created plate ${plateId}`);
      }
    } else if (action === 'create') {
      console.log('Executing create action');
      // Connections are already resolved (no -1 placeholders)
      const plateId = addPlate(ghostPlate.midpointPosition.y, ghostPlate.sku_id, ghostPlate.connections, shelf);

      if (plateId !== -1) {
        console.log(`Ghost plate created successfully as plate ${plateId}`);
        success = true;
      } else {
        console.log('Failed to create plate');
      }
    }

    undoManager.saveState('addGhostPlate');
    callbacks.rebuildGeometry();
  }

  function onGhostRodClick(ghostRod: GhostRod) {
    if (!ghostRod.legal) {
      console.log('Cannot merge rods here - illegal placement');
      return;
    }

    console.log(`Merging rods ${ghostRod.bottomRodId} and ${ghostRod.topRodId} into SKU ${ghostRod.sku_id}`);

    // Merge the rods
    mergeRods(ghostRod.bottomRodId, ghostRod.topRodId, ghostRod.sku_id, shelf);

    // Save undo state
    undoManager.saveState('mergeRods');

    // Rebuild geometry
    callbacks.rebuildGeometry();
  }

  // Pointer event handling for raycasting
  function onPointerMove(event: PointerEvent) {
    const pointer = new THREE.Vector2();
    // Convert to normalized device coordinates (-1 to +1)
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(pointer, camera);

    // Test for intersections with all scene objects (recursive: true checks nested objects)
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Clear all hover states first
    shelf.plates.forEach(plate => {
      (plate as any).isHovered = false;
    });
    scene.children.forEach((child: any) => {
      if (child.userData?.type === 'ghost_plate' && child.material) {
        const ghostPlate = child.userData.ghostPlate;
        const isLegal = ghostPlate?.legal;
        // Legal ghosts: 0.15 normally, 0.3 in debug mode
        // Illegal ghosts: 0.0 normally, 0.3 in debug mode
        child.material.opacity = isLegal ? (getDebugMode() ? 0.3 : 0.15) : (getDebugMode() ? 0.3 : 0.0);
      }
      // Also reset ghost rod opacity
      if ((child.userData?.type === 'ghost_rod' || child.userData?.type === 'ghost_connection_rod') && child.material) {
        // Find the associated ghost plate to check if it's legal
        const ghostPlateIndex = child.userData.ghostPlateIndex;
        const ghostPlate = shelf.ghostPlates[ghostPlateIndex];
        const isLegal = ghostPlate?.legal;
        child.material.opacity = isLegal ? (getDebugMode() ? 0.3 : 0.15) : (getDebugMode() ? 0.3 : 0.0);
      }
      // Reset plate hover color
      if (child.userData?.type === 'plate' && child.material) {
        child.material.color.setHex(0x76685e); // Original color
      }
    });

    // Hide tooltip by default
    if (tooltipContainer) {
      tooltipContainer.style.display = 'none';
    }

    // Find first hit with userData.type (plate, ghost_plate, or rod)
    for (const hit of intersects) {
      const userData = hit.object.userData;

      if (userData?.type === 'plate') {
        const plateId = userData.plateId;
        const plate = shelf.plates.get(plateId);
        if (plate && tooltipContainer) {
          (plate as any).isHovered = true;

          // Change plate color to slightly red to indicate deletion
          (hit.object.material as any).color.setHex(0xa85e5e); // Reddish tint

          // Show tooltip
          tooltipContainer.style.display = 'block';
          tooltipContainer.style.left = `${event.clientX + 20}px`;
          tooltipContainer.style.top = `${event.clientY + 20}px`;

          if (getDebugMode()) {
            // Debug mode: show full JSON
            tooltipContainer.textContent = `Plate ${plateId} (click to delete)\n` + JSON.stringify(plate, null, 2);
          } else {
            // Normal mode: show human-readable info
            const plateSKU = getPlateSKU(plate.sku_id);
            if (plateSKU) {
              tooltipContainer.textContent = `${plateSKU.name}\nClick to delete`;
            }
          }
        }
        break; // Plates take priority
      } else if (userData?.type === 'rod') {
        const rodId = userData.rodId;
        const rod = shelf.rods.get(rodId);
        if (rod && tooltipContainer) {
          // Show tooltip
          tooltipContainer.style.display = 'block';
          tooltipContainer.style.left = `${event.clientX + 20}px`;
          tooltipContainer.style.top = `${event.clientY + 20}px`;

          if (getDebugMode()) {
            // Debug mode: show full JSON
            tooltipContainer.textContent = `Rod ${rodId}\n` + JSON.stringify(rod, null, 2);
          } else {
            // Normal mode: show human-readable info
            const rodSKU = getRodSKU(rod.sku_id);
            if (rodSKU) {
              tooltipContainer.textContent = rodSKU.name;
            }
          }
        }
        break;
      } else if (userData?.type === 'ghost_plate') {
        const ghostPlate = userData.ghostPlate;
        const ghostPlateIndex = userData.ghostPlateIndex;
        const targetOpacity = ghostPlate.legal ? 0.5 : 0.3;

        // Update ghost plate opacity
        (hit.object.material as any).opacity = targetOpacity;

        // Also update all associated ghost rods with the same ghostPlateIndex
        scene.children.forEach((child: any) => {
          if (child.userData?.ghostPlateIndex === ghostPlateIndex) {
            if (child.userData?.type === 'ghost_rod' ||
                child.userData?.type === 'ghost_connection_rod') {
              (child.material as any).opacity = targetOpacity;
            }
          }
        });

        // Show tooltip
        if (tooltipContainer) {
          tooltipContainer.style.display = 'block';
          tooltipContainer.style.left = `${event.clientX + 20}px`;
          tooltipContainer.style.top = `${event.clientY + 20}px`;

          if (getDebugMode()) {
            // Debug mode: show full JSON
            tooltipContainer.textContent = JSON.stringify(ghostPlate, null, 2);
          } else {
            // Normal mode: show human-readable info
            const plateSKU = getPlateSKU(ghostPlate.sku_id);
            if (plateSKU && ghostPlate.legal) {
              const actionText = ghostPlate.action === 'create' ? 'Add' :
                                ghostPlate.action === 'extend' ? 'Extend' :
                                ghostPlate.action === 'merge' ? 'Merge' : '';
              tooltipContainer.textContent = `${actionText} ${plateSKU.name}`;
            } else if (!ghostPlate.legal) {
              tooltipContainer.textContent = 'Invalid';
            }
          }
        }
        break;
      } else if (userData?.type === 'ghostRod') {
        const ghostRodIndex = userData.ghostRodIndex;
        const ghostRod = shelf.ghostRods[ghostRodIndex];
        const targetOpacity = ghostRod.legal ? 0.5 : 0.3;

        // Update opacity for all ghost rod cylinders with the same index
        scene.children.forEach((child: any) => {
          if (child.userData?.type === 'ghostRod' &&
              child.userData?.ghostRodIndex === ghostRodIndex) {
            (child.material as any).opacity = targetOpacity;
          }
        });

        // Show tooltip
        if (tooltipContainer) {
          tooltipContainer.style.display = 'block';
          tooltipContainer.style.left = `${event.clientX + 20}px`;
          tooltipContainer.style.top = `${event.clientY + 20}px`;

          if (getDebugMode()) {
            // Debug mode: show full JSON
            tooltipContainer.textContent = JSON.stringify(ghostRod, null, 2);
          } else {
            // Normal mode: show human-readable info
            if (ghostRod.legal) {
              tooltipContainer.textContent = 'Merge Rods';
            } else {
              tooltipContainer.textContent = 'Invalid';
            }
          }
        }
        break;
      }
    }
  }

  function onPointerClick(event: PointerEvent) {
    const pointer = new THREE.Vector2();
    // Convert to normalized device coordinates
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Find first hit with userData.type (plate, ghost_plate, or rod)
    // Priority order: plates > rods > ghost plates > ghost rods
    for (const hit of intersects) {
      const userData = hit.object.userData;

      if (userData?.type === 'plate') {
        onPlateClick(userData.plateId, hit.point);
        return; // Plates take priority
      } else if (userData?.type === 'rod') {
        onRodClick(userData.rodId, hit.point);
        return; // Real rods take priority over ghosts
      }
    }

    // If no plate or rod was hit, check for ghost elements
    for (const hit of intersects) {
      const userData = hit.object.userData;

      if (userData?.type === 'ghost_plate') {
        onGhostPlateClick(userData.ghostPlate);
        return;
      } else if (userData?.type === 'ghostRod') {
        const ghostRodIndex = userData.ghostRodIndex;
        const ghostRod = shelf.ghostRods[ghostRodIndex];
        onGhostRodClick(ghostRod);
        return;
      }
    }

  }

  // Keyboard shortcuts for undo/redo
  function onKeyDown(event: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? event.metaKey : event.ctrlKey;
    const key = event.key.toLowerCase();

    // Ctrl+Z / Cmd+Z: Undo
    if (ctrlKey && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      if (undoManager.undo()) {
        console.log('Undo successful');
      }
      return;
    }

    // Ctrl+Shift+Z / Cmd+Shift+Z: Redo
    // Also support Ctrl+Y / Cmd+Y
    if ((ctrlKey && key === 'z' && event.shiftKey) || (ctrlKey && key === 'y')) {
      event.preventDefault();
      if (undoManager.redo()) {
        console.log('Redo successful');
      }
      return;
    }
  }

  // Bind events
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerClick);
  window.addEventListener('keydown', onKeyDown);

  // Return cleanup function
  return {
    dispose() {
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerClick);
      window.removeEventListener('keydown', onKeyDown);
    },
    undoManager
  };
}