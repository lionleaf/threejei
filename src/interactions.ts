import { type Shelf, removePlate, removeSegmentFromPlate, removeRodSegment, addPlate, addRod, type Plate, type Rod, AVAILABLE_RODS, calculateAttachmentPositions, mergeColocatedRods, tryMergePlates, tryExtendPlate, Direction, type PlateSegmentResult } from './shelf-model.js';
import { DEBUG_SHOW_COLLIDERS } from './shelf_viz.js';

// Declare THREE as global (loaded via CDN)
declare const THREE: any;

export interface InteractionSystem {
  dispose(): void;
}

export interface RegenerationCallbacks {
  rebuildGeometry: () => void;
}

export function setupInteractions(
  shelf: Shelf,
  scene: any,
  camera: any,
  renderer: any,
  callbacks: RegenerationCallbacks
): InteractionSystem {
  // Raycasting setup
  const raycaster = new THREE.Raycaster();

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

    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
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
      callbacks.rebuildGeometry();
    } else {
      console.log(`Failed to remove plate segment`);
    }
  }

  function onGhostPlateClick(ghostPlate: any) {
    if (!ghostPlate.legal) {
      console.log('Cannot add plate here - illegal placement');
      return;
    }

    if (!ghostPlate.sku_id || !ghostPlate.connections) {
      console.log('Ghost plate missing required data');
      return;
    }

    const action = ghostPlate.action || 'create';
    console.log(`Ghost plate action: ${action}, sku_id=${ghostPlate.sku_id}, connections=${ghostPlate.connections}`);

    let success = false;

    if (action === 'merge') {
      console.log('Executing merge action');

      if (ghostPlate.connections.length >= 2) {
        const leftRodId = ghostPlate.connections[0];
        const rightRodId = ghostPlate.connections[ghostPlate.connections.length - 1];

        const leftRod = shelf.rods.get(leftRodId);
        const rightRod = shelf.rods.get(rightRodId);

        if (leftRod && rightRod) {
          const y = ghostPlate.position.y;
          const leftAttachmentY = y - leftRod.position.y;
          const rightAttachmentY = y - rightRod.position.y;

          const leftAttachment = leftRod.attachmentPoints.find(ap => ap.y === leftAttachmentY);
          const rightAttachment = rightRod.attachmentPoints.find(ap => ap.y === rightAttachmentY);

          if (leftAttachment?.plateId !== undefined && rightAttachment?.plateId !== undefined) {
            const leftPlateId = leftAttachment.plateId;
            const rightPlateId = rightAttachment.plateId;

            console.log(`Merging plates ${leftPlateId} and ${rightPlateId}`);
            const mergedPlateId = tryMergePlates(leftPlateId, rightPlateId, shelf);
            success = mergedPlateId !== -1;

            if (success) {
              console.log(`Successfully merged into plate ${mergedPlateId}`);
            } else {
              console.log('Merge failed, falling back to create');
            }
          }
        }
      }
    } else if (action === 'extend') {
      console.log('Executing extend action');

      if (ghostPlate.existingPlateId !== undefined && ghostPlate.direction) {
        const extendDirection = ghostPlate.direction === 'left' ? Direction.Left : Direction.Right;
        console.log(`Extending plate ${ghostPlate.existingPlateId} in direction ${extendDirection}`);

        success = tryExtendPlate(ghostPlate.existingPlateId, extendDirection, shelf);

        if (success) {
          console.log(`Successfully extended plate ${ghostPlate.existingPlateId}`);
        } else {
          console.log('Extend failed, falling back to create');
        }
      }
    }

    if (!success && action === 'create') {
      console.log('Executing create action');

      const actualRodIds = ghostPlate.connections.map((rodId: number) => {
        if (rodId === -1) {
          const newRodId = addRod({ x: ghostPlate.position.x, y: ghostPlate.position.y }, 1, shelf);
          console.log(`Created new rod ${newRodId} at (${ghostPlate.position.x}, ${ghostPlate.position.y})`);
          return newRodId;
        }
        return rodId;
      });

      const plateId = addPlate(ghostPlate.position.y, ghostPlate.sku_id, actualRodIds, shelf);

      if (plateId !== -1) {
        console.log(`Ghost plate created successfully as plate ${plateId}`);

        const newRodXPositions = new Set<number>();
        ghostPlate.connections.forEach((rodId: number, index: number) => {
          if (rodId === -1) {
            const rod = shelf.rods.get(actualRodIds[index]);
            if (rod) {
              newRodXPositions.add(rod.position.x);
            }
          }
        });

        newRodXPositions.forEach(x => {
          mergeColocatedRods(x, shelf);
        });

        success = true;
      } else {
        console.log('Failed to create plate');
      }
    }

    if (success) {
      callbacks.rebuildGeometry();
    }
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
        child.material.opacity = DEBUG_SHOW_COLLIDERS ? 0.3 : 0.0;
      }
    });

    // Find first hit with userData.type (plate or ghost_plate)
    for (const hit of intersects) {
      const userData = hit.object.userData;

      if (userData?.type === 'plate') {
        const plate = shelf.plates.get(userData.plateId);
        if (plate) {
          (plate as any).isHovered = true;
        }
        break; // Plates take priority
      } else if (userData?.type === 'ghost_plate') {
        const ghostPlate = userData.ghostPlate;
        if (ghostPlate.legal) {
          (hit.object.material as any).opacity = 0.5;
        } else {
          (hit.object.material as any).opacity = 0.3;
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
    for (const hit of intersects) {
      const userData = hit.object.userData;

      if (userData?.type === 'plate') {
        onPlateClick(userData.plateId, hit.point);
        break; // Plates take priority
      } else if (userData?.type === 'ghost_plate') {
        onGhostPlateClick(userData.ghostPlate);
        break;
      } else if (userData?.type === 'rod') {
        onRodClick(userData.rodId, hit.point);
        break;
      }
    }
  }

  // Bind pointer events
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerClick);

  // Return cleanup function
  return {
    dispose() {
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerClick);
    }
  };
}