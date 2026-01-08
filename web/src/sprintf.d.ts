import { TranslatedString } from "./i18n";

// redeclare the sprintf() function types, if the format argument is a
// TranslatedString then the result is TranslatedString as well, if it is a
// plain string then the result is a plain string as well
declare module "sprintf-js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function sprintf<T extends string | TranslatedString>(format: T, ...args: any[]): T;
}
