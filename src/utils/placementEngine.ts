/**
 * Placement Engine for Memory Worlds
 * Handles natural object positioning within world environments
 */

import {
  PlacementPosition,
  PlacementLayer,
  ObjectCategory,
  WorldObject,
  WorldType,
  PLACEMENT_RULES,
  WORLD_THEMES,
} from '../types';

// Layer Y positions (percentage from top)
const LAYER_Y_RANGES: Record<PlacementLayer, { min: number; max: number }> = {
  sky: { min: 5, max: 25 },
  back: { min: 25, max: 45 },
  middle: { min: 45, max: 65 },
  front: { min: 65, max: 85 },
  ground: { min: 85, max: 95 },
};

// Layer scale ranges (objects farther back are smaller)
const LAYER_SCALE_MODIFIERS: Record<PlacementLayer, number> = {
  sky: 0.5,
  back: 0.7,
  middle: 1.0,
  front: 1.2,
  ground: 1.0,
};

// Z-index for proper layering
const LAYER_Z_INDEX: Record<PlacementLayer, number> = {
  sky: 10,
  back: 20,
  middle: 30,
  front: 40,
  ground: 50,
};

interface PlacementConstraints {
  existingObjects: WorldObject[];
  worldType: WorldType;
  avoidOverlap: boolean;
  preferredLayer?: PlacementLayer;
}

/**
 * Calculate optimal position for a new object
 */
export function calculateObjectPosition(
  category: ObjectCategory,
  constraints: PlacementConstraints
): PlacementPosition {
  const rules = PLACEMENT_RULES[category];
  const layer = constraints.preferredLayer || rules.preferredLayers[0];
  const yRange = LAYER_Y_RANGES[layer];

  // Get existing objects in the same layer
  const layerObjects = constraints.existingObjects.filter(
    obj => obj.position.layer === layer
  );

  // Calculate X position to avoid overlaps
  let x = calculateXPosition(layerObjects, constraints.avoidOverlap);

  // Calculate Y position within layer range
  let y = calculateYPosition(yRange, layerObjects, x);

  // Calculate scale based on layer and rules
  const baseScale = rules.scaleRange[0] + Math.random() * (rules.scaleRange[1] - rules.scaleRange[0]);
  const scale = baseScale * LAYER_SCALE_MODIFIERS[layer];

  return {
    x,
    y,
    scale,
    layer,
    zIndex: LAYER_Z_INDEX[layer] + (y - yRange.min), // Objects lower in frame are in front
  };
}

/**
 * Calculate X position avoiding overlaps with existing objects
 */
function calculateXPosition(existingObjects: WorldObject[], avoidOverlap: boolean): number {
  if (existingObjects.length === 0 || !avoidOverlap) {
    // First object or no overlap avoidance - pick a nice spot
    return 20 + Math.random() * 60; // 20-80%
  }

  // Find gaps between existing objects
  const sortedX = existingObjects
    .map(obj => obj.position.x)
    .sort((a, b) => a - b);

  // Calculate minimum spacing based on scale
  const minSpacing = 12;

  // Find the largest gap
  let bestGap = { start: 10, end: sortedX[0] || 90 };
  let bestGapSize = bestGap.end - bestGap.start;

  for (let i = 0; i < sortedX.length; i++) {
    const gapStart = sortedX[i];
    const gapEnd = sortedX[i + 1] || 90;
    const gapSize = gapEnd - gapStart;

    if (gapSize > bestGapSize && gapSize > minSpacing) {
      bestGap = { start: gapStart, end: gapEnd };
      bestGapSize = gapSize;
    }
  }

  // Place in the middle of the best gap
  return bestGap.start + (bestGap.end - bestGap.start) / 2 + (Math.random() - 0.5) * 5;
}

/**
 * Calculate Y position within layer range
 */
function calculateYPosition(
  yRange: { min: number; max: number },
  existingObjects: WorldObject[],
  x: number
): number {
  // Base Y in middle of range
  let y = yRange.min + (yRange.max - yRange.min) / 2;

  // Add some randomness
  y += (Math.random() - 0.5) * (yRange.max - yRange.min) * 0.6;

  // Avoid vertical overlaps near same X position
  const nearbyObjects = existingObjects.filter(
    obj => Math.abs(obj.position.x - x) < 15
  );

  if (nearbyObjects.length > 0) {
    // Offset slightly
    const avgY = nearbyObjects.reduce((sum, obj) => sum + obj.position.y, 0) / nearbyObjects.length;
    if (Math.abs(y - avgY) < 10) {
      y = y > avgY ? avgY + 10 : avgY - 10;
    }
  }

  // Clamp to range
  return Math.max(yRange.min, Math.min(yRange.max, y));
}

/**
 * Check if a position overlaps with existing objects
 */
export function checkOverlap(
  position: PlacementPosition,
  existingObjects: WorldObject[],
  threshold: number = 10
): boolean {
  for (const obj of existingObjects) {
    if (obj.position.layer !== position.layer) continue;

    const dx = Math.abs(position.x - obj.position.x);
    const dy = Math.abs(position.y - obj.position.y);

    if (dx < threshold && dy < threshold) {
      return true;
    }
  }
  return false;
}

/**
 * Redistribute objects to avoid clutter
 */
export function redistributeObjects(
  objects: WorldObject[]
): WorldObject[] {
  const redistributed: WorldObject[] = [];
  const layers = ['sky', 'back', 'middle', 'front', 'ground'] as PlacementLayer[];

  for (const layer of layers) {
    const layerObjects = objects.filter(obj => obj.position.layer === layer);

    if (layerObjects.length <= 1) {
      redistributed.push(...layerObjects);
      continue;
    }

    // Sort by X position
    layerObjects.sort((a, b) => a.position.x - b.position.x);

    // Spread evenly across layer
    const spacing = 70 / (layerObjects.length + 1);
    layerObjects.forEach((obj, index) => {
      const newX = 15 + spacing * (index + 1);
      redistributed.push({
        ...obj,
        position: {
          ...obj.position,
          x: newX + (Math.random() - 0.5) * 5,
        },
      });
    });
  }

  return redistributed;
}

/**
 * Get animation delay for staggered entry
 */
export function getEntryAnimationDelay(index: number): number {
  return index * 100; // 100ms stagger
}

/**
 * Calculate camera focus position for an object
 */
export function getCameraFocusPosition(
  object: WorldObject,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number; scale: number } {
  // Convert percentage to viewport coordinates
  const x = (object.position.x / 100) * viewportWidth;
  const y = (object.position.y / 100) * viewportHeight;

  return {
    x: viewportWidth / 2 - x,
    y: viewportHeight / 2 - y,
    scale: 1.5, // Zoom in slightly
  };
}

/**
 * Get world-specific ambient particle settings
 */
export function getAmbientParticleConfig(worldType: WorldType): {
  type: 'dust' | 'fireflies' | 'petals' | 'snow' | 'leaves';
  count: number;
  color: string;
  speed: number;
} {
  const theme = WORLD_THEMES.find(t => t.id === worldType);

  switch (worldType) {
    case 'terra':
      return { type: 'dust', count: 15, color: '#DBEAFE', speed: 0.3 };
    case 'luna':
      return { type: 'dust', count: 12, color: '#E0E7FF', speed: 0.2 };
    case 'nova':
      return { type: 'fireflies', count: 20, color: '#FEF3C7', speed: 0.5 };
    case 'celestia':
      return { type: 'petals', count: 18, color: '#FCE7F3', speed: 0.4 };
    case 'aurora':
      return { type: 'fireflies', count: 25, color: '#D1FAE5', speed: 0.5 };
    case 'solaris':
      return { type: 'dust', count: 10, color: '#FEE2E2', speed: 0.4 };
    default:
      return { type: 'dust', count: 10, color: theme?.ambientColor || '#FFFFFF', speed: 0.3 };
  }
}

/**
 * Get world progression percentage
 */
export function getWorldProgressionPercent(objectCount: number, maxObjects: number = 30): number {
  return Math.min(100, (objectCount / maxObjects) * 100);
}

/**
 * Get world stage based on object count
 */
export function getWorldStage(objectCount: number): 'empty' | 'growing' | 'rich' | 'flourishing' {
  if (objectCount >= 20) return 'flourishing';
  if (objectCount >= 11) return 'rich';
  if (objectCount >= 4) return 'growing';
  return 'empty';
}
