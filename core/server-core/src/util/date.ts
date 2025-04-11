export const MaxDate = (date: Date, ...dates: Date[]) => {
  for (let d of dates) {
    if (d > date) {
      date = d;
    }
  }
  return date;
};
