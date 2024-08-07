/*
 * Copyright (c) [2024] SUSE LLC
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

import axios from "axios";

const http = axios.create({
  responseType: "json",
});

/**
 * Retrieves the object from given URL
 *
 * @param url - HTTP URL
 * @return data from the response body
 */
const get = (url: string) => http.get(url).then(({ data }) => data);

/**
 * Performs a PATCH request with the given URL and data
 *
 * @param url - endpoint URL
 * @param data - Request payload
 */
const patch = (url: string, data: object) => http.patch(url, data);

/**
 * Performs a PUT request with the given URL and data
 *
 * @param url - endpoint URL
 * @param data - request payload
 */
const put = (url: string, data: object) => http.put(url, data);

/**
 * Performs a POST request with the given URL and data
 *
 * @param url - endpoint URL
 * @param data - request payload
 */
const post = (url: string, data: object) => http.post(url, data);

/**
 * Performs a DELETE request on the given URL
 *
 * @param url - endpoint URL
 * @param data - request payload
 */
const del = (url: string) => http.delete(url);

export { get, patch, post, put, del };
