/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import axios from "axios";

let demo_data;
if (process.env.AGAMA_DEMO) {
  demo_data = await import(process.env.AGAMA_DEMO);
}

const http = axios.create({
  responseType: "json",
});

// FIXME: share with web/src/context/installerL10n.tsx
function agamaLanguage(): string | undefined {
  // language from cookie, empty string if not set (regexp taken from Cockpit)
  // https://github.com/cockpit-project/cockpit/blob/98a2e093c42ea8cd2431cf15c7ca0e44bb4ce3f1/pkg/shell/shell-modals.jsx#L91
  return decodeURIComponent(
    document.cookie.replace(/(?:(?:^|.*;\s*)agamaLang\s*=\s*([^;]*).*$)|^.*$/, "$1"),
  );
}

function mock_response(method: string, url: string) {
  console.info("Demo mode, ignoring request", method, url);

  return Promise.resolve({
    data: {},
    status: 200,
    statusText: "OK",
    headers: {},
    config: {
      headers: {},
    },
  });
}

/**
 * Retrieves the object from given URL
 *
 * @param url - HTTP URL
 * @return data from the response body
 */
const get = (url: string) => {
  if (process.env.AGAMA_DEMO) {
    const lang = agamaLanguage() || "en-US";

    // try translated demo data first
    if (demo_data[lang] && url in demo_data[lang]) {
      return Promise.resolve(demo_data[lang][url]);
    } else if (url in demo_data) {
      return Promise.resolve(demo_data[url]);
    } else {
      console.error(`Missing demo data for REST API path ${url} (lang: ${lang})`);
      return {};
    }
  } else {
    return http.get(url).then(({ data }) => data);
  }
};

/**
 * Performs a PATCH request with the given URL and data
 *
 * @param url - endpoint URL
 * @param data - Request payload
 */
const patch = (url: string, data?: object) =>
  process.env.AGAMA_DEMO ? mock_response("PATCH", url) : http.patch(url, data);

/**
 * Performs a PUT request with the given URL and data
 *
 * @param url - endpoint URL
 * @param data - request payload
 */
const put = (url: string, data: object) =>
  process.env.AGAMA_DEMO ? mock_response("PUT", url) : http.put(url, data);

/**
 * Performs a POST request with the given URL and data
 *
 * @param url - endpoint URL
 * @param data - request payload
 */
const post = (url: string, data?: object) =>
  process.env.AGAMA_DEMO ? mock_response("POST", url) : http.post(url, data);

/**
 * Performs a DELETE request on the given URL
 *
 * @param url - endpoint URL
 * @param data - request payload
 */
const del = (url: string) =>
  process.env.AGAMA_DEMO ? mock_response("DELETE", url) : http.delete(url);

export { get, patch, post, put, del };
