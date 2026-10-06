/**
 * Star positions as a CSS box-shadow list. Seeded, so the HTML is identical on every build.
 * Put the result on a 1-2px element: each shadow is one star.
 *  unit 'cq' = % of the nearest size container (cqw/cqh), used by the home hero;
 *  unit 'vw' = % of the viewport (vw/vh), used by the fixed page-wide layer.
 */
export function sky(count: number, seed: number, colors: string[], blur = 0, unit: 'cq' | 'v' = 'cq'): string {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const w = unit === 'cq' ? 'cqw' : 'vw';
  const h = unit === 'cq' ? 'cqh' : 'vh';
  return Array.from({ length: count }, () => {
    const x = (rnd() * 100).toFixed(1);
    const y = (rnd() * 100).toFixed(1);
    return `${x}${w} ${y}${h} ${blur}px ${colors[Math.floor(rnd() * colors.length)]}`;
  }).join(',');
}
