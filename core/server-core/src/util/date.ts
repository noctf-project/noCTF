export const MaxDate = (date: Date, ...dates: Date[]) => {
  for (const d of dates) {
    if (d > date) {
      date = d;
    }
  }
  return date;
};
