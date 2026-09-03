/*
 * Copyright (c) [2026] SUSE LLC
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
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import { useCallback, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const DEFAULT_FONT_SIZE = 14;

/** Control message the server sends when the shell exits. */
type ExitMessage = { type: "exit"; code: number };

export type TerminalSession = {
  /**
   * Attaches the terminal to the given DOM element. Safe to call more than
   * once (e.g., on every render) or before the session itself exists: it
   * just remembers the element, and the terminal opens in it as soon as
   * both are available.
   */
  attach: (container: HTMLElement | null) => void;
  /** Changes the font size and refits the terminal to its container. */
  setFontSize: (size: number) => void;
  /** Clears the terminal's scrollback and screen. */
  clear: () => void;
  /** Resizes the terminal to fill its current container size. */
  fit: () => void;
};

/**
 * Builds the terminal WebSocket URL for the current page, following the same
 * pattern used for the main `/api/ws` connection (same origin, upgrading the
 * scheme to `ws:`/`wss:`).
 */
function terminalWebSocketUrl(): string {
  const url = new URL(window.location.toString());
  url.hash = "";
  url.pathname = url.pathname.concat("api/terminal/ws");
  url.protocol = url.protocol === "http:" ? "ws" : "wss";
  return url.toString();
}

/**
 * Owns the xterm.js terminal instance and its WebSocket connection for the
 * lifetime of a terminal session (`isOpen`).
 *
 * The instance and the connection are independent from whether the terminal
 * panel is currently visible or mounted: they are created the first time
 * `isOpen` becomes `true` (the connection is created when the user opens the
 * terminal for the first time), and only torn down when it goes back to
 * `false` (the user closed the terminal). Hiding or minimizing the panel
 * does not call this hook with a different `isOpen` value, so the session
 * (and its scrollback) survives both.
 *
 * If the WebSocket disconnects unexpectedly, a new one is opened right away
 * (a new backend shell), reusing the same terminal instance and scrollback;
 * per the terminal's error handling rules, there is no attempt to recover
 * the previous shell.
 */
export const useTerminalSession = (isOpen: boolean): TerminalSession => {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);

  /** Opens the terminal in its container, if both are ready and it is not open yet. */
  const openIfReady = useCallback(() => {
    const terminal = terminalRef.current;
    const container = containerRef.current;
    if (terminal && container && !terminal.element) {
      terminal.open(container);
      fitAddonRef.current?.fit();
    }
  }, []);

  const connect = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const socket = new WebSocket(terminalWebSocketUrl());
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.onopen = () => fitAddonRef.current?.fit();

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data) as ExitMessage;
          if (message.type === "exit") {
            terminal.write(`\r\n[exited with code ${message.code}]\r\n`);
          }
        } catch {
          // Not a message this client understands; ignore it.
        }
        return;
      }

      terminal.write(new Uint8Array(event.data as ArrayBuffer));
    };

    socket.onclose = () => {
      // A newer socket has already replaced this one, or the session was
      // closed on purpose: nothing to do.
      if (socketRef.current !== socket || closingRef.current) return;

      terminal.write("\r\n[connection lost, starting a new session]\r\n");
      connect();
    };
  }, []);

  const ensureSession = useCallback(() => {
    if (terminalRef.current) return;

    closingRef.current = false;

    const terminal = new Terminal({
      fontSize: DEFAULT_FONT_SIZE,
      cursorBlink: true,
      theme: { background: "#1e1e1e", foreground: "#d4d4d4" },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.onData((data) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(new TextEncoder().encode(data));
      }
    });

    terminal.onResize(({ cols, rows }) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ cols, rows }));
      }
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    openIfReady();
    connect();
  }, [connect, openIfReady]);

  const teardown = useCallback(() => {
    closingRef.current = true;
    socketRef.current?.close();
    socketRef.current = null;
    terminalRef.current?.dispose();
    terminalRef.current = null;
    fitAddonRef.current = null;
    containerRef.current = null;
  }, []);

  useEffect(() => {
    if (isOpen) {
      ensureSession();
    } else {
      teardown();
    }
  }, [isOpen, ensureSession, teardown]);

  // Also tear down if the provider owning this hook ever unmounts (e.g., the
  // whole application is torn down), so no connection is leaked.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => teardown, []);

  const attach = useCallback(
    (container: HTMLElement | null) => {
      containerRef.current = container;
      openIfReady();
    },
    [openIfReady],
  );

  const setFontSize = useCallback((size: number) => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontSize = size;
    fitAddonRef.current?.fit();
  }, []);

  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const fit = useCallback(() => {
    fitAddonRef.current?.fit();
  }, []);

  return { attach, setFontSize, clear, fit };
};
