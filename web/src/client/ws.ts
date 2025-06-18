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

import { noop } from "radashi";

type RemoveFn = () => void;
type BaseHandlerFn = () => void;
export type EventHandlerFn = (event) => void;
export type ErrorHandlerFn = (error: object) => void;

/**
 * Enum for the WebSocket states.
 */
const SocketStates = Object.freeze({
  CONNECTED: 0,
  CONNECTING: 1,
  CLOSING: 2,
  CLOSED: 3,
  UNRECOVERABLE: 4,
});

const MAX_ATTEMPTS = 15;
const ATTEMPT_INTERVAL = 1000;

// WebSocket client interface
//
// It defines the interface a WebSocket client should adhere to.
// The main point is to make it possible to replace the native
// WebSocket implementation with something else in the tests.
interface WSClientIface {
  isConnected: () => boolean;
  isRecoverable: () => boolean;
  onOpen: (func: BaseHandlerFn) => RemoveFn;
  onError: (func: ErrorHandlerFn) => RemoveFn;
  onClose: (func: BaseHandlerFn) => RemoveFn;
  onEvent: (func: EventHandlerFn) => RemoveFn;
}

/**
 * Agama WebSocket client.
 *
 * Connects to the Agama WebSocket server and reacts on the events.
 * This class is not expected to be used directly, but through the
 * HTTPClient API.
 */
class WSClient implements WSClientIface {
  url: string;

  client: WebSocket;

  handlers: {
    open: Array<BaseHandlerFn>;
    close: Array<BaseHandlerFn>;
    error: Array<ErrorHandlerFn>;
    events: Array<EventHandlerFn>;
  };

  reconnectAttempts: number;

  timeout: ReturnType<typeof setTimeout>;

  /**
   * @param  url - Websocket URL.
   */
  constructor(url: URL) {
    this.url = url.toString();

    this.handlers = {
      error: [],
      close: [],
      open: [],
      events: [],
    };

    this.reconnectAttempts = 0;
    this.client = this.buildClient();
  }

  wsState() {
    const state = this.client.readyState;
    if (state !== SocketStates.CONNECTED && this.reconnectAttempts >= MAX_ATTEMPTS)
      return SocketStates.UNRECOVERABLE;

    return state;
  }

  isRecoverable() {
    return this.wsState() !== SocketStates.UNRECOVERABLE;
  }

  isConnected() {
    return this.wsState() === SocketStates.CONNECTED;
  }

  buildClient() {
    const client = new WebSocket(this.url);
    client.onopen = () => {
      console.log("Websocket connected");
      this.reconnectAttempts = 0;
      clearTimeout(this.timeout);

      return this.dispatchOpenEvent();
    };

    client.onmessage = (event) => {
      console.debug("Event received", event);
      this.dispatchEvent(event);
    };

    client.onclose = () => {
      console.log("WebSocket closed");
      this.dispatchCloseEvent();
      this.timeout = setTimeout(() => this.connect(this.reconnectAttempts + 1), ATTEMPT_INTERVAL);
    };

    client.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.dispatchErrorEvent(error);
    };

    return client;
  }

  connect(attempt = 0) {
    this.reconnectAttempts = attempt;
    if (attempt > MAX_ATTEMPTS) {
      console.log("Max number of WebSocket connection attempts reached.");
      return;
    }
    console.log(`Reconnecting WebSocket(attempt: ${attempt})`);
    this.client = this.buildClient();
  }

  /**
   * Registers a handler for events.
   *
   * The handler is executed for all events. It is up to the callback to
   * filter the relevant ones for it.
   */
  onEvent(func: EventHandlerFn): RemoveFn {
    this.handlers.events.push(func);
    return () => {
      const position = this.handlers.events.indexOf(func);
      if (position > -1) this.handlers.events.splice(position, 1);
    };
  }

  /**
   * Registers a handler for close socket.
   *
   * The handler is executed when the socket is close.
   */
  onClose(func: BaseHandlerFn): RemoveFn {
    this.handlers.close.push(func);

    return () => {
      const position = this.handlers.close.indexOf(func);
      if (position > -1) this.handlers.close.splice(position, 1);
    };
  }

  /**
   * Registers a handler for open socket.
   *
   * The handler is executed when the socket is open.
   */
  onOpen(func: BaseHandlerFn): RemoveFn {
    this.handlers.open.push(func);

    return () => {
      const position = this.handlers.open.indexOf(func);
      if (position > -1) this.handlers.open.splice(position, 1);
    };
  }

  /**
   * Registers a handler for socket errors.
   *
   * The handler is executed when an error is reported by the socket.
   */
  onError(func: ErrorHandlerFn): RemoveFn {
    this.handlers.error.push(func);

    return () => {
      const position = this.handlers.error.indexOf(func);
      if (position > -1) this.handlers.error.splice(position, 1);
    };
  }

  /**
   * @private
   *
   * Dispatchs an event by running all the handlers.
   *
   * @param event - Event object, which is basically a websocket message.
   */
  dispatchEvent(event: MessageEvent) {
    const eventObject = JSON.parse(event.data);
    this.handlers.events.forEach((f) => f(eventObject));
  }

  /**
   * @private
   *
   * Dispatchs a close event by running all its handlers.
   */
  dispatchCloseEvent() {
    this.handlers.close.forEach((f) => f());
  }

  /**
   * @private
   *
   * Dispatchs an error event by running all its handlers.
   */
  dispatchErrorEvent(error) {
    this.handlers.error.forEach((f) => f(error));
  }

  /**
   * @private
   *
   * Dispatchs a close event by running all its handlers.
   */
  dispatchOpenEvent() {
    this.handlers.open.forEach((f) => f());
  }
}

// WebSocket client to be used in the tests.
class DummyWSClient implements WSClientIface {
  isConnected() {
    return true;
  }

  isRecoverable() {
    return true;
  }

  onOpen(): RemoveFn {
    return noop;
  }

  onError(): RemoveFn {
    return noop;
  }

  onClose(): RemoveFn {
    return noop;
  }

  onEvent(): RemoveFn {
    return noop;
  }
}

export { WSClient, DummyWSClient };
export type { WSClientIface };
