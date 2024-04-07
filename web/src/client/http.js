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

// @ts-check

/**
 * @callback RemoveFn
 * @return {void}
 */

/**
 * Agama WebSocket client.
 *
 * Connects to the Agama WebSocket server and reacts on the events.
 * This class is not expected to be used directly, but through the
 * HTTPClient API.
 */
class WSClient {
  /**
   * @param {URL} url - Websocket URL.
   */
  constructor(url) {
    this.client = new WebSocket(url.toString());
    this.client.onmessage = (event) => {
      this.dispatchEvent(event);
    };
    this.handlers = [];
  }

  /**
   * Registers a handler for events.
   *
   * The handler is executed for all the events. It is up to the callback to
   * filter the relevant events.
   *
   * @param {(object) => void} func - Handler function to register.
   * @return {RemoveFn}
   */
  onEvent(func) {
    this.handlers.push(func);
    return () => {
      const position = this.handlers.indexOf(func);
      if (position > -1) this.handlers.splice(position, 1);
    };
  }

  /**
   * @private
   *
   * Dispatchs an event by running all the handlers.
   *
   * @param {object} event - Event object, which is basically a websocket message.
   */
  dispatchEvent(event) {
    const eventObject = JSON.parse(event.data);
    this.handlers.forEach((f) => f(eventObject));
  }
}

/**
 * Agama HTTP API client.
 */
class HTTPClient {
  /**
   * @param {URL} url - URL of the HTTP API.
   */
  constructor(url) {
    const httpUrl = new URL(url.toString());
    httpUrl.pathname = url.pathname.concat("api");
    this.baseUrl = httpUrl.toString();

    const wsUrl = new URL(url.toString());
    wsUrl.pathname = wsUrl.pathname.concat("api/ws");
    wsUrl.protocol = (url.protocol === "http:") ? "ws" : "wss";
    this.ws = new WSClient(wsUrl);
  }

  /**
   * @param {string} url - Endpoint URL (e.g., "/l10n/config").
   * @return {Promise<object>} Server response.
   */
  async get(url) {
    const response = await fetch(`${this.baseUrl}${url}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return await response.json();
  }

  /**
   * @param {string} url - Endpoint URL (e.g., "/l10n/config").
   * @param {object} data - Data to submit
   * @return {Promise<object>} Server response.
   */
  async post(url, data) {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });

    try {
      return await response.json();
    } catch (e) {
      console.warn("Expecting a JSON response", e);
      return response.status === 200;
    }
  }

  /**
   * @param {string} url - Endpoint URL (e.g., "/l10n/config").
   * @param {object} data - Data to submit
   * @return {Promise<object>} Server response.
   */
  async put(url, data) {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response;
  }

  /**
   * @param {string} url - Endpoint URL (e.g., "/l10n/config").
   * @return {Promise<Response>} Server response.
   */
  async delete(url) {
    const response = await fetch(`${this.baseUrl}/${url}`, {
      method: "DELETE",
    });

    return response;
  }

  /**
   * @param {string} url - Endpoint URL (e.g., "/l10n/config").
   * @param {object} data - Data to submit
   * @return {Promise<Response>} Server response.
   */
  async patch(url, data) {
    const response = await fetch(`${this.baseUrl}/${url}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response;
  }

  /**
   * Registers a handler for a given type of events.
   *
   * @param {string} type - Event type (e.g., "LocaleChanged").
   * @param {(object) => void} func - Handler function to register.
   * @return {RemoveFn} - Function to remove the handler.
   */
  onEvent(type, func) {
    return this.ws.onEvent((event) => {
      if (event.type === type) {
        func(event);
      }
    });
  }
}

export { HTTPClient };
