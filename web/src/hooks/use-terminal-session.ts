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

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { ITheme, Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { TERMINAL_HINT_ID, TERMINAL_INPUT_ID } from "~/context/terminal";
import "@xterm/xterm/css/xterm.css";

const DEFAULT_FONT_SIZE = 14;

/**
 * Control message the server sends when the shell exits. Exactly one of
 * `code` or `signal` is set: `code` for a normal exit (any way the shell
 * ends on its own — `exit`, `exit N`, Ctrl-D), `signal` when it was killed
 * by an unhandled signal instead (e.g., a crash).
 */
type ExitMessage = { type: "exit"; code: number | null; signal: number | null };

export type TerminalSession = {
  /** Changes the font size and refits the terminal to its container. */
  setFontSize: (size: number) => void;
  /** Clears the terminal's scrollback and screen. */
  clear: () => void;
};

export type TerminalSessionOptions = {
  /**
   * Called when the user asks to leave the terminal with the keyboard (see
   * the escape hatch described below). It is expected to move the focus
   * somewhere outside the terminal; the session itself is not affected.
   */
  onLeave?: () => void;
  /**
   * Called when the shell exits normally on its own (see below). Expected to
   * close the terminal panel; the session itself has already ended.
   */
  onGracefulExit?: () => void;
};

/**
 * Colors the terminal is painted with, taken from the theme.
 *
 * xterm.js draws its own surface instead of using CSS, so the values have to be
 * handed to it as plain strings. Reading them from the same tokens the
 * stylesheets use (see `tokens/_semantic.scss`) keeps the terminal and its
 * surroundings the same color, including when a product retunes them.
 *
 * A token with no value is left out, so xterm.js falls back to its own default
 * instead of being told to paint with an empty color.
 */
function terminalTheme(): ITheme {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim() || undefined;

  return {
    background: token("--agm-t--terminal--background--color"),
    foreground: token("--agm-t--terminal--color"),
  };
}

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
 * The session ends, without any attempt to recover it, as soon as its socket
 * closes for any reason other than the panel itself being closed on purpose:
 *
 * - The shell exits normally on its own (the user typed `exit`, pressed
 *   Ctrl-D, or the process otherwise returned): the server reports it with
 *   an "exit" message right before closing the socket, and `onGracefulExit`
 *   is called — the caller is expected to close the panel in response,
 *   since that is exactly what closing a terminal window means everywhere
 *   else. This happens whatever the exit code, since e.g. plain `exit` in
 *   bash exits with the status of the last command run, which says nothing
 *   about whether the user actually meant to leave.
 * - The shell is killed by an unhandled signal instead (a crash, an
 *   out-of-memory kill, an external `kill`, ...): reported the same way,
 *   but `onGracefulExit` is *not* called — this is unexpected, so the
 *   terminal is left open with a message, the same as a dropped connection.
 * - The connection drops unexpectedly (e.g., a network issue or the backend
 *   restarting): also left open with a message.
 *
 * None of these reconnect automatically: a new connection always starts an
 * unrelated, brand new shell (there is no session persistence on the
 * backend), so silently reconnecting would not actually be resuming
 * anything — it would just as silently discard whatever the user was doing
 * (working directory, running command, shell history), with no way to tell
 * from the keyboard. Other than a graceful exit (see above), the user gets a
 * new session by closing and reopening the panel.
 *
 * ## Leaving the terminal with the keyboard
 *
 * A terminal has to take over almost every key, Tab included (shells use it
 * to complete words). That makes it a keyboard trap: once focused, someone
 * not using a pointer has no way back to the rest of the interface, which
 * WCAG forbids (SC 2.1.2, "No Keyboard Trap").
 *
 * The way out is pressing Escape and then Tab, the same sequence code
 * editors embedded in a page use for this very problem (Monaco, CodeMirror,
 * Ace). Escape keeps reaching the shell as usual: only a Tab typed right
 * after one is taken, and that combination means nothing to a shell. When it
 * happens, `onLeave` is called so the caller can move the focus out.
 */
export const useTerminalSession = (
  container: HTMLElement | null,
  { onLeave, onGracefulExit }: TerminalSessionOptions = {},
): TerminalSession => {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const closingRef = useRef(false);
  const sessionEndedRef = useRef(false);
  // Read through refs so a caller passing inline callbacks does not tear
  // down the terminal and its shell on every render.
  const onLeaveRef = useRef(onLeave);
  const onGracefulExitRef = useRef(onGracefulExit);
  useLayoutEffect(() => {
    onLeaveRef.current = onLeave;
    onGracefulExitRef.current = onGracefulExit;
  }, [onLeave, onGracefulExit]);

  const connect = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    sessionEndedRef.current = false;
    const socket = new WebSocket(terminalWebSocketUrl());
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.onopen = () => {
      fitAddonRef.current?.fit();
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data) as ExitMessage;
          if (message.type === "exit") {
            sessionEndedRef.current = true;

            if (message.signal !== null) {
              // Killed by a signal: unexpected, so leave the terminal open
              // with a message instead of closing the panel.
              terminal.write(`\r\n[terminated by signal ${message.signal}]\r\n`);
            } else {
              // A normal exit: nothing to show, the panel is about to close.
              onGracefulExitRef.current?.();
            }
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

      socketRef.current = null;

      // The shell already reported its own exit above; nothing more to show.
      if (sessionEndedRef.current) return;

      terminal.write("\r\n[connection lost]\r\n");
    };
  }, []);

  // Terminal and socket lifecycle: created once when the panel opens,
  // regardless of whether there is a container to render into yet; disposed
  // when it closes (this hook's caller unmounts).
  useEffect(() => {
    closingRef.current = false;
    sessionEndedRef.current = false;

    const terminal = new Terminal({
      fontSize: DEFAULT_FONT_SIZE,
      cursorBlink: true,
      theme: terminalTheme(),
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Escape hatch for keyboard users; see "Leaving the terminal with the
    // keyboard" above. `afterEscape` lives here, next to the terminal it
    // belongs to, because both are created and dropped together.
    let afterEscape = false;
    terminal.attachCustomKeyEventHandler((event) => {
      // The handler also runs for keypress and keyup; keydown is enough.
      if (event.type !== "keydown") return true;

      if (afterEscape && event.key === "Tab" && onLeaveRef.current) {
        afterEscape = false;
        // The focus is moved by the caller, so the browser must not move it
        // on its own too.
        event.preventDefault();
        onLeaveRef.current();
        // Keeps xterm.js from sending the key to the shell.
        return false;
      }

      afterEscape = event.key === "Escape";
      return true;
    });

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
      // xterm.js renders the input the user actually types into. Naming it
      // makes it a target for the links that jump into the terminal, and
      // pointing it at the hint gets the way out announced on arrival.
      if (terminal.textarea) {
        terminal.textarea.id = TERMINAL_INPUT_ID;
        terminal.textarea.setAttribute("aria-describedby", TERMINAL_HINT_ID);
      }
      // Attaching only happens when the panel opens, always after an explicit
      // request from the user, so the terminal takes the focus right away and
      // is ready to type in.
      terminal.focus();
    } else if (terminal.element.parentElement !== container) {
      // The container is unmounted and a new one takes its place whenever
      // the panel toggles in and out of "not enough space" (see
      // TerminalDock), so this also runs on every such toggle, not just the
      // first attachment. xterm.js's own open() does not help here: it only
      // moves the terminal to a different *browser window*, and is a no-op
      // if called again for one already open in the same window. Without
      // this, the existing element stays attached to the old, now-detached
      // container: blank and impossible to type into, even though the
      // session underneath is still alive.
      container.appendChild(terminal.element);
      terminal.focus();
    }
    fitAddon.fit();

    if (typeof ResizeObserver === "undefined") return;

    // A collapsed panel takes its container out of the layout, which reports a
    // zero-sized box. Fitting to it would shrink the terminal to a single row
    // and tell the shell about it, reflowing the output that is being kept.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      fitAddon.fit();
    });
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
