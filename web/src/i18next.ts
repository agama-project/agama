import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HTTPApi from "i18next-http-backend";

i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(HTTPApi)
  .init({
    debug: true,
    fallbackLng: false, // We're using English keys as fallback.
    lng: "es",
    interpolation: {
      escapeValue: false,
    },
    load: "languageOnly",
    nsSeparator: false,
    keySeparator: false,
    backend: {
      loadPath: "/po-{{lng}}.json",
    },
  });

export default i18next;
