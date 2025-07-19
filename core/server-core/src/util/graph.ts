export const WindowDeltaedTimeSeriesPoints = (
  points: [number, number][],
  windowSize = 1,
  reducer = (a: number, b: number) => a + b,
) => {
  if (windowSize === 1 || points.length === 0) return points;
  let t = points[0][0];
  let x = Math.floor(t / windowSize) * windowSize;
  let l = 0;
  let y = points[0][1];
  let out: [number, number][] = [];
  for (const p of points.slice(1)) {
    const w = Math.floor((t += p[0]) / windowSize) * windowSize;
    if (w === x) {
      y = reducer(y, p[1]);
    } else {
      out.push([x - l, y]);
      l = x;
      x = w;
      y = p[1];
    }
  }
  console.log(x, t);
  out.push([x - l, y]);
  return out;
};
