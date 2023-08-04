/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

// import React from "react";

/**
 * Helper function for storing the Cockpit language.
 * @param {String} lang the new language tag (like "cs", "cs-cz",...)
 */
function setLang(lang) {
  // code taken from Cockpit
  const cookie = "CockpitLang=" + encodeURIComponent(lang) + "; path=/; expires=Sun, 16 Jul 3567 06:23:41 GMT";
  document.cookie = cookie;
  window.localStorage.setItem("cockpit.lang", lang);
}

/**
 * Helper function for reloading the page.
 */
function reload() {
  window.location.reload(true);
}

/**
 * This is a helper component to set the language used in the UI. It uses the
 * URL "lang" query parameter or the preferred language from the browser.
 * To activate a new language it reloads the whole page.
 *
 * It behaves like a wrapper, it just wraps the children components, it does
 * not render any real content.
 *
 * @param {React.ReactNode} [props.children] - content to display within the
 * wrapper
 */
export default function L10nWrapper({ children }) {
  // language from cookie, empty string if not set (regexp taken from Cockpit)
  const langCookie = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)CockpitLang\s*=\s*([^;]*).*$)|^.*$/, "$1"));
  // "lang" query parameter from the URL, null if not set
  let langQuery = (new URLSearchParams(window.location.search)).get("lang");

  // set the language from the URL query
  if (langQuery) {
    // convert "pt_BR" to Cockpit compatible "pt-br"
    langQuery = langQuery.toLowerCase().replace("_", "-");
    if (langCookie !== langQuery) {
      setLang(langQuery);
      reload();
    }
  } else {
    // if the language has not been configured yet use the preferred language
    // from the browser, so far do it only in the development mode because there
    // are not enough translations available
    //
    // TODO: use the navigator.languages list to find a supported language, the
    // first preferred language might not be supported by Agama
    if (process.env.NODE_ENV !== "production" && langCookie === "" && navigator.language) {
      // convert browser language "pt-BR" to Cockpit compatible "pt-br"
      setLang(navigator.language.toLowerCase());
      reload();
    }
  }

  return children;
}
