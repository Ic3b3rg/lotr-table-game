import type { Frame, Vector } from './model';
export const NUMERICAL_POLICY = 'portable-transform-f32-v1';
export const f = Math.fround;
export const plus = (a: Vector, b: Vector): Vector => [
  f(a[0] + b[0]),
  f(a[1] + b[1]),
  f(a[2] + b[2]),
];
export const minus = (a: Vector, b: Vector): Vector => [
  f(a[0] - b[0]),
  f(a[1] - b[1]),
  f(a[2] - b[2]),
];
export const times = (a: Vector, n: number): Vector => [f(a[0] * n), f(a[1] * n), f(a[2] * n)];
export const sqr = (v: Vector): number => f(f(f(v[0] * v[0]) + f(v[1] * v[1])) + f(v[2] * v[2]));

/** Explicit portable policy, not Unity Quaternion/Transform native equivalence. */
export function turn(v: Vector, intervals: number): Vector {
  const angle = (-(((intervals % 6) + 6) % 6) * Math.PI) / 3,
    c = f(Math.cos(angle)),
    s = f(Math.sin(angle));
  return [f(f(c * v[0]) - f(s * v[1])), f(f(s * v[0]) + f(c * v[1])), v[2]];
}
function quaternion(v: Vector, q: Frame['rotation']): Vector {
  const [x, y, z, w] = q;
  const t: Vector = [
    f(2 * f(f(y * v[2]) - f(z * v[1]))),
    f(2 * f(f(z * v[0]) - f(x * v[2]))),
    f(2 * f(f(x * v[1]) - f(y * v[0]))),
  ];
  return [
    f(f(v[0] + f(w * t[0])) + f(f(y * t[2]) - f(z * t[1]))),
    f(f(v[1] + f(w * t[1])) + f(f(z * t[0]) - f(x * t[2]))),
    f(f(v[2] + f(w * t[2])) + f(f(x * t[1]) - f(y * t[0]))),
  ];
}
/** Frames are ordered from the hex/node transform toward its tile (excluded). */
export function transform(point: Vector, frames: Frame[]): Vector {
  let p: Vector = [...point];
  for (const frame of frames)
    p = plus(
      quaternion(
        [f(p[0] * frame.scale[0]), f(p[1] * frame.scale[1]), f(p[2] * frame.scale[2])],
        frame.rotation,
      ),
      frame.position,
    );
  return p;
}
export function strictSphere(
  a: { position: Vector; radius: number },
  b: { position: Vector; radius: number },
): boolean {
  const radius = f(a.radius + b.radius);
  return sqr(minus(a.position, b.position)) < f(radius * radius);
}
