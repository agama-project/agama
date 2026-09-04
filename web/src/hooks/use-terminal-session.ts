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
  /** Changes the font size and refits the terminal to its container. */
  setFontSize: (size: number) => void;
  /** Clears the terminal's scrollback and screen. */
  clear: () => void;
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
 * Owns an xterm.js terminal instance and its WebSocket connection for as
 * long as the calling component (`TerminalPane`) is mounted — which, in
 * turn, only happens while the terminal is open (see `context/terminal.tsx`
 * and `TerminalDock`). Opening the terminal creates the connection; closing
 * it (unmounting) ends it. Minimizing never unmounts the caller, so it does
 * not affect the session.
 *
 * `container` is the DOM element to render into. It may be `null` at first
 * (e.g., while the panel is showing its "not enough room" message instead of
 * the real terminal) — the terminal still connects right away, and attaches
 * to the container as soon as one becomes available.
 *
 * If the WebSocket disconnects unexpectedly, a new one is opened right away
 * (a new backend shell), reusing the same terminal instance and scrollback;
 * per the terminal's error handling rules, there is no attempt to recover
 * the previous shell.
 */
export const useTerminalSession = (container: HTMLElement | null): TerminalSession => {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const closingRef = useRef(false);

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

  // Terminal and socket lifecycle: created once when the panel opens,
  // regardless of whether there is a container to render into yet; disposed
  // when it closes (this hook's caller unmounts).
  useEffect(() => {
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
    connect();

    return () => {
      closingRef.current = true;
      socketRef.current?.close();
      socketRef.current = null;
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [connect]);

  // DOM attachment and fit-on-resize: re-run whenever the container element
  // itself changes, which also covers it appearing later (e.g., once there
  // is enough room to show the real terminal instead of a message).
  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!container || !terminal || !fitAddon) return;

    if (!terminal.element) {
      terminal.open(container);
    }
    fitAddon.fit();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  const setFontSize = useCallback((size: number) => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontSize = size;
    fitAddonRef.current?.fit();
  }, []);

  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  return { setFontSize, clear };
};
