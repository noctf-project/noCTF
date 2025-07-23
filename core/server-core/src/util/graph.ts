export const WindowDeltaedTimeSeriesPoints = (
  points: [number[], number[]] | undefined,
  windowSize = 1,
  reducer = (a: number, b: number) => a + b,
): [number[], number[]] => {
  if (!points) return [[], []];
  if (points[0].length !== points[1].length) throw new Error("Invalid graph");
  if (windowSize === 1 || points[0].length === 0) return points;
  let t = points[0][0];
  let x = Math.floor(t / windowSize) * windowSize;
  let l = 0;
  let y = points[1][0];
  const out: [number[], number[]] = [[], []];
  for (let p = 1; p < points[0].length; p++) {
    const w = Math.floor((t += points[0][p]) / windowSize) * windowSize;
    if (w === x) {
      y = reducer(y, points[1][p]);
    } else {
      out[0].push(x - l);
      out[1].push(y);
      l = x;
      x = w;
      y = points[1][p];
    }
  }
  out[0].push(x - l);
  out[1].push(y);
  return out;
};
