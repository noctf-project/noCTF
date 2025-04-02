export const countryCodeToFlag = (countryCode: string) => {
  if (
    !countryCode ||
    countryCode.length !== 2 ||
    !/^[a-zA-Z]+$/.test(countryCode)
  ) {
    return "";
  }
  return Array.from(countryCode.toUpperCase())
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 0x1f1a5))
    .join("");
};
