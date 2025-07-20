export const Delay = (timeoutMillis: number) =>
  new Promise((resolve) => setTimeout(resolve, timeoutMillis));

export const IsTimeBetweenSeconds = (
  time: number | Date,
  start_s?: number,
  end_s?: number,
) => {
  const ctime =
    typeof time === "number" ? time : Math.floor(time.getTime() / 1000);
  console.log(ctime);
  if (typeof start_s === "number" && ctime <= start_s) {
    return false;
  }
  if (typeof end_s === "number" && ctime >= end_s) {
    return false;
  }
  return true;
};
