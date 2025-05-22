import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
countries.registerLocale(en);

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

export const countryCodeToName = (countryCode: string) => {
  return countries.getName(countryCode, "en");
};

export const AllCountries = countries.getNames("en", { select: "official" });
