/**
 * Copyright 2017-2024, Voxel51, Inc.
 */

// adapted from https://medium.com/google-design/google-photos-45b714dfbed1
export default (
  items: number[],
  threshold: number,
  remainder: boolean
): number[] => {
  if (threshold < 1) {
    throw new TilingException(
      `threshold must be greater than 1, received ${threshold}`
    );
  }

  if (!items.length) {
    return [];
  }

  const findCursor = () => {
    const keys = Array.from(nodes.keys()).sort((a, b) => b - a);

    if (!remainder) return keys[0];

    let cursor: number;
    let score = Number.POSITIVE_INFINITY;
    let length: number;

    for (const next of keys) {
      const node = nodes.get(next);
      const nextScore = node.score();

      if (node.length() < length) {
        break;
      }

      if (score === undefined || nextScore < score) {
        score = nextScore;
        cursor = next;
        length = node.length();
      } else break;
    }

    return cursor;
  };

  const row = (start: number, end: number) => {
    const key = `${start}:${end}`;
    if (!cache.has(key)) {
      const aspectRatio = items
        .slice(start, end)
        .reduce((sum, aspectRatio) => sum + aspectRatio, 0);
      const delta = threshold - aspectRatio;
      cache.set(key, {
        delta,
        score: (1 + Math.abs(delta)) ** 3,
      });
    }

    return cache.get(key);
  };

  const cache = new Map<string, { delta: number; score: number }>();

  const nodes = new Map<
    number,
    { length: () => number; parent: number; score: () => number }
  >();
  const search = (parent: number, item: number) => {
    const score = () => {
      if (parent === 0) {
        return row(parent, item).score;
      }

      return row(parent, item).score + nodes.get(parent)?.score() || 0;
    };

    const length = () => {
      if (parent === 0) {
        return 1;
      }

      return 1 + nodes.get(parent).length();
    };

    const node = nodes.get(item);
    if (!node) {
      nodes.set(item, {
        length,
        parent,
        score,
      });
    } else {
      if (node.score() >= score()) {
        nodes.set(item, {
          length,
          parent,
          score,
        });
      }
      return;
    }

    let end = item + 1;
    while (end <= items.length) {
      const edge = row(item, end);
      if (edge.delta <= 0) {
        search(item, end);
      }

      end++;
    }

    return;
  };

  search(0, 0);
  let cursor = findCursor();

  const result = [];
  while (cursor) {
    result.push(cursor);
    cursor = nodes.get(cursor)?.parent;
  }

  result.reverse();

  if (!remainder && !result.includes(items.length)) {
    result.push(items.length);
  }

  return result;
};

export class TilingException extends Error {}
