import { Word } from '../types';

interface WordPosition {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
}

// Minimum distance between bubbles (in percentage points)
const MIN_DISTANCE_X = 22; // Bubbles are ~140px wide on ~400px screen = ~35%
const MIN_DISTANCE_Y = 12; // Bubbles are ~50px tall

/**
 * Calculate positions for word bubbles on a photo
 * Uses AI-provided positions, then adjusts to prevent overlaps
 */
export function calculateWordPositions(words: Word[]): Map<string, WordPosition> {
  const positions = new Map<string, WordPosition>();
  const count = words.length;

  if (count === 0) return positions;

  // Collect all initial positions (from AI or generate fallbacks)
  const initialPositions: { word: Word; pos: WordPosition }[] = [];

  words.forEach((word, index) => {
    if (word.position) {
      initialPositions.push({
        word,
        pos: {
          x: Math.max(12, Math.min(88, word.position.x)),
          y: Math.max(12, Math.min(78, word.position.y)),
        },
      });
    } else {
      // Fallback position based on index
      const fallbackPos = getFallbackPosition(index, count);
      initialPositions.push({ word, pos: fallbackPos });
    }
  });

  // Resolve collisions by adjusting positions
  const resolvedPositions = resolveCollisions(initialPositions);

  // Store final positions
  resolvedPositions.forEach(({ word, pos }) => {
    positions.set(word.id, pos);
  });

  return positions;
}

/**
 * Get a fallback position based on index when AI doesn't provide one
 */
function getFallbackPosition(index: number, total: number): WordPosition {
  // Distribute in a loose grid pattern
  const cols = Math.ceil(Math.sqrt(total * 1.5));
  const row = Math.floor(index / cols);
  const col = index % cols;

  const xStep = 70 / Math.max(cols - 1, 1);
  const yStep = 55 / Math.max(Math.ceil(total / cols) - 1, 1);

  return {
    x: 15 + col * xStep + (Math.random() - 0.5) * 8,
    y: 18 + row * yStep + (Math.random() - 0.5) * 6,
  };
}

/**
 * Resolve overlapping positions by nudging bubbles apart
 */
function resolveCollisions(
  items: { word: Word; pos: WordPosition }[]
): { word: Word; pos: WordPosition }[] {
  const result = items.map(item => ({
    word: item.word,
    pos: { ...item.pos },
  }));

  // Multiple passes to resolve collisions
  for (let pass = 0; pass < 5; pass++) {
    let hadCollision = false;

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i].pos;
        const b = result[j].pos;

        const dx = b.x - a.x;
        const dy = b.y - a.y;

        // Check if too close
        if (Math.abs(dx) < MIN_DISTANCE_X && Math.abs(dy) < MIN_DISTANCE_Y) {
          hadCollision = true;

          // Calculate push direction
          const pushX = dx === 0 ? (Math.random() > 0.5 ? 1 : -1) : (dx > 0 ? 1 : -1);
          const pushY = dy === 0 ? (Math.random() > 0.5 ? 1 : -1) : (dy > 0 ? 1 : -1);

          // Push bubbles apart
          const pushAmount = 4;
          a.x = clamp(a.x - pushX * pushAmount, 12, 88);
          a.y = clamp(a.y - pushY * pushAmount * 0.5, 12, 78);
          b.x = clamp(b.x + pushX * pushAmount, 12, 88);
          b.y = clamp(b.y + pushY * pushAmount * 0.5, 12, 78);
        }
      }
    }

    if (!hadCollision) break;
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get a suggested next word based on exploration state
 * Prioritizes unexplored words with lowest mastery
 */
export function suggestNextWord(
  words: Word[],
  exploredIds: Set<string>,
  quizzedIds: Set<string>
): Word | null {
  // First priority: unexplored words
  const unexplored = words.filter(w => !exploredIds.has(w.id));
  if (unexplored.length > 0) {
    return unexplored.sort((a, b) => a.masteryScore - b.masteryScore)[0];
  }

  // Second priority: explored but not quizzed
  const unquizzed = words.filter(
    w => exploredIds.has(w.id) && !quizzedIds.has(w.id)
  );
  if (unquizzed.length > 0) {
    return unquizzed.sort((a, b) => a.masteryScore - b.masteryScore)[0];
  }

  return null;
}
