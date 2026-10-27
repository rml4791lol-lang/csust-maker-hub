import { cn } from "@/lib/utils";

type Point = [number, number, number];
type Face = [number, number, number];

function normalize([x, y, z]: Point): Point {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

/** The same icosahedron topology as the Hero, subdivided once on a sphere. */
function makeWireframe() {
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const vertices: Point[] = [
    [-1, goldenRatio, 0], [1, goldenRatio, 0],
    [-1, -goldenRatio, 0], [1, -goldenRatio, 0],
    [0, -1, goldenRatio], [0, 1, goldenRatio],
    [0, -1, -goldenRatio], [0, 1, -goldenRatio],
    [goldenRatio, 0, -1], [goldenRatio, 0, 1],
    [-goldenRatio, 0, -1], [-goldenRatio, 0, 1],
  ].map((point) => normalize(point as Point));
  const faces: Face[] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const midpoints = new Map<string, number>();
  const midpoint = (a: number, b: number) => {
    const key = [a, b].sort((first, second) => first - second).join(":");
    const existing = midpoints.get(key);
    if (existing !== undefined) return existing;
    const first = vertices[a];
    const second = vertices[b];
    const index = vertices.push(normalize([
      (first[0] + second[0]) / 2,
      (first[1] + second[1]) / 2,
      (first[2] + second[2]) / 2,
    ])) - 1;
    midpoints.set(key, index);
    return index;
  };
  const edges = new Map<string, [number, number]>();
  for (const [a, b, c] of faces) {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    const triangles: Face[] = [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]];
    for (const triangle of triangles) {
      for (let index = 0; index < 3; index++) {
        const edge = [triangle[index], triangle[(index + 1) % 3]]
          .sort((first, second) => first - second) as [number, number];
        edges.set(edge.join(":"), edge);
      }
    }
  }

  // Fixed model rotation and perspective: no random decoration or runtime motion.
  const projected = vertices.map(([x, y, z]) => {
    const rotatedX = x * Math.cos(-0.42) + z * Math.sin(-0.42);
    const rotatedZ = -x * Math.sin(-0.42) + z * Math.cos(-0.42);
    const rotatedY = y * Math.cos(0.25) - rotatedZ * Math.sin(0.25);
    const depth = y * Math.sin(0.25) + rotatedZ * Math.cos(0.25);
    const screenX = rotatedX * Math.cos(0.18) - rotatedY * Math.sin(0.18);
    const screenY = rotatedX * Math.sin(0.18) + rotatedY * Math.cos(0.18);
    const perspective = 4 / (4 - depth);
    return {
      x: Number((210 + screenX * 164 * perspective).toFixed(3)),
      y: Number((210 - screenY * 164 * perspective).toFixed(3)),
      depth,
    };
  });
  return Array.from(edges, ([key, [a, b]]) => ({
    key,
    first: projected[a],
    second: projected[b],
    depth: (projected[a].depth + projected[b].depth) / 2,
  })).sort((first, second) => first.depth - second.depth);
}

const wireframe = makeWireframe();

/** Static decoration: readable without WebGL and identical across SSR/hydration. */
export function GeometryMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 420"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("pointer-events-none text-primary", className)}
    >
      {wireframe.map(({ key, first, second, depth }) => (
        <line
          key={key}
          x1={first.x}
          y1={first.y}
          x2={second.x}
          y2={second.y}
          stroke="currentColor"
          strokeWidth={depth > 0 ? 1 : 0.8}
          strokeOpacity={Number((0.18 + ((depth + 1) / 2) * 0.64).toFixed(3))}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
