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

// setupTests.ts mocks this module by default (see its manual mock), since
// most tests only care about the terminal chrome, not the real session.
// This file is the exception: it exercises the real hook.
jest.unmock("~/hooks/use-terminal-session");

jest.mock("@xterm/xterm", () => {
  class MockTerminal {
    static instances: MockTerminal[] = [];

    options: Record<string, unknown>;
    element: HTMLElement | undefined = undefined;
    onDataCallback: ((data: string) => void) | undefined;
    onResizeCallback: ((size: { cols: number; rows: number }) => void) | undefined;
    keyEventHandler: ((event: KeyboardEvent) => boolean) | undefined;
    // Mirrors real xterm.js: creates its own element and appends it to the
    // given parent, but only the first time — calling open() again on an
    // already-open terminal (in the same window) is a no-op, see
    // CoreBrowserTerminal.ts's open(). Re-attaching to a different parent
    // has to be done by hand, by moving `element` (see use-terminal-session).
    open = jest.fn((container: HTMLElement) => {
      if (this.element) return;
      this.element = document.createElement("div");
      container.appendChild(this.element);
    });

    textarea: HTMLTextAreaElement = document.createElement("textarea");
    write = jest.fn();
    clear = jest.fn();
    dispose = jest.fn();
    loadAddon = jest.fn();
    focus = jest.fn();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      MockTerminal.instances.push(this);
    }

    onData(callback: (data: string) => void) {
      this.onDataCallback = callback;
    }

    onResize(callback: (size: { cols: number; rows: number }) => void) {
      this.onResizeCallback = callback;
    }

    attachCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean) {
      this.keyEventHandler = handler;
    }
  }

  return { Terminal: MockTerminal };
});

jest.mock("@xterm/addon-fit", () => {
  class MockFitAddon {
    static instances: MockFitAddon[] = [];
    fit = jest.fn();

    constructor() {
      MockFitAddon.instances.push(this);
    }
  }

  return { FitAddon: MockFitAddon };
});

import { renderHook, act } from "@testing-library/react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useTerminalSession } from "~/hooks/use-terminal-session";

type MockTerminalInstance = InstanceType<typeof Terminal> & {
  onDataCallback?: (data: string) => void;
  onResizeCallback?: (size: { cols: number; rows: number }) => void;
  keyEventHandler?: (event: KeyboardEvent) => boolean;
};

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];

  url: string;
  binaryType = "";
  readyState = MockWebSocket.OPEN;
  send = jest.fn();
  close = jest.fn();
  onopen?: () => void;
  onmessage?: (event: { data: unknown }) => void;
  onclose?: () => void;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

const terminalInstances = () => (Terminal as unknown as { instances: unknown[] }).instances;
const lastTerminal = () =>
  (Terminal as unknown as { instances: MockTerminalInstance[] }).instances.at(-1);
const lastFitAddon = () =>
  (FitAddon as unknown as { instances: InstanceType<typeof FitAddon>[] }).instances.at(-1);
const lastSocket = () => MockWebSocket.instances.at(-1);

const mockOnGracefulExit = jest.fn();

// Renders the hook with a container prop and the shared onGracefulExit mock.
const renderSession = () =>
  renderHook(
    ({ container }) => useTerminalSession(container, { onGracefulExit: mockOnGracefulExit }),
    {
      initialProps: { container: null as HTMLElement | null },
    },
  );

beforeEach(() => {
  (Terminal as unknown as { instances: unknown[] }).instances = [];
  (FitAddon as unknown as { instances: unknown[] }).instances = [];
  MockWebSocket.instances = [];
  (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
  mockOnGracefulExit.mockClear();
});

describe("useTerminalSession", () => {
  it("creates a terminal and connects a socket to the terminal endpoint on mount", () => {
    renderSession();

    expect(terminalInstances()).toHaveLength(1);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(lastSocket()?.url).toMatch(/\/api\/terminal\/ws$/);
  });

  it("does not create a second session on rerender", () => {
    const { rerender } = renderSession();

    rerender({ container: null });

    expect(terminalInstances()).toHaveLength(1);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("opens the terminal once a container becomes available", () => {
    const { rerender } = renderSession();

    expect(lastTerminal()?.open).not.toHaveBeenCalled();

    const container = document.createElement("div");
    rerender({ container });

    expect(lastTerminal()?.open).toHaveBeenCalledWith(container);
    expect(lastFitAddon()?.fit).toHaveBeenCalled();
  });

  it("re-attaches to a new container after the old one is unmounted", () => {
    // What TerminalDock does whenever the panel toggles in and out of "not
    // enough space": the container is unmounted (container -> null) and a
    // brand new one takes its place once there is room again.
    const { rerender } = renderSession();

    const firstContainer = document.createElement("div");
    rerender({ container: firstContainer });
    const element = lastTerminal()?.element;
    expect(element?.parentElement).toBe(firstContainer);

    rerender({ container: null });
    const secondContainer = document.createElement("div");
    rerender({ container: secondContainer });

    // The same terminal element (session, scrollback) is reused, just moved
    // into the new container — xterm.js's own open() would not do this on
    // its own (see the mock above), leaving it attached to the first,
    // by-then-detached container: blank and impossible to type into.
    expect(lastTerminal()?.open).toHaveBeenCalledTimes(1);
    expect(element?.parentElement).toBe(secondContainer);
    expect(lastTerminal()?.focus).toHaveBeenCalled();
  });

  it("names the terminal input and focuses it once attached", () => {
    const { rerender } = renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    rerender({ container: document.createElement("div") });

    expect(lastTerminal()?.textarea).toHaveAttribute("id", "terminal-input");
    // So that the way out of the terminal is announced on arrival.
    expect(lastTerminal()?.textarea).toHaveAttribute("aria-describedby", "terminal-keyboard-hint");
    expect(lastTerminal()?.focus).toHaveBeenCalled();
  });

  it("forwards typed data to the socket as a binary frame", () => {
    renderSession();

    act(() => lastTerminal()?.onDataCallback?.("echo hi"));

    expect(lastSocket()?.send).toHaveBeenCalledWith(new TextEncoder().encode("echo hi"));
  });

  it("sends a resize as a JSON text frame", () => {
    renderSession();

    act(() => lastTerminal()?.onResizeCallback?.({ cols: 100, rows: 30 }));

    expect(lastSocket()?.send).toHaveBeenCalledWith(JSON.stringify({ cols: 100, rows: 30 }));
  });

  it("writes incoming binary frames to the terminal", () => {
    renderSession();

    const bytes = new TextEncoder().encode("hello from the shell");
    act(() => lastSocket()?.onmessage?.({ data: bytes.buffer }));

    expect(lastTerminal()?.write).toHaveBeenCalledWith(new Uint8Array(bytes.buffer));
  });

  it("calls onGracefulExit, without writing a message, on a normal shell exit", () => {
    renderSession();

    act(() =>
      lastSocket()?.onmessage?.({
        data: JSON.stringify({ type: "exit", code: 7, signal: null }),
      }),
    );

    expect(mockOnGracefulExit).toHaveBeenCalled();
    expect(lastTerminal()?.write).not.toHaveBeenCalled();
  });

  it("writes a message, without calling onGracefulExit, when the shell is killed by a signal", () => {
    renderSession();

    act(() =>
      lastSocket()?.onmessage?.({
        data: JSON.stringify({ type: "exit", code: null, signal: 11 }),
      }),
    );

    expect(lastTerminal()?.write).toHaveBeenCalledWith(expect.stringContaining("signal 11"));
    expect(mockOnGracefulExit).not.toHaveBeenCalled();
  });

  it("does not reconnect after a clean shell exit (e.g. typing 'exit' or Ctrl-D)", () => {
    renderSession();

    act(() =>
      lastSocket()?.onmessage?.({
        data: JSON.stringify({ type: "exit", code: 0, signal: null }),
      }),
    );
    act(() => lastSocket()?.onclose?.());

    // Only the original (now closed) socket: no new shell was started, or
    // the user would never be able to leave the terminal from the keyboard.
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(mockOnGracefulExit).toHaveBeenCalled();
    expect(lastTerminal()?.write).not.toHaveBeenCalledWith(
      expect.stringContaining("connection lost"),
    );
  });

  it("does not reconnect after the shell is killed by a signal", () => {
    renderSession();

    act(() =>
      lastSocket()?.onmessage?.({
        data: JSON.stringify({ type: "exit", code: null, signal: 11 }),
      }),
    );
    act(() => lastSocket()?.onclose?.());

    // Only the original (now closed) socket, and no additional
    // "connection lost" message on top of the signal one already shown.
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(lastTerminal()?.write).not.toHaveBeenCalledWith(
      expect.stringContaining("connection lost"),
    );
  });

  it("shows a message, but does not reconnect, if the connection drops unexpectedly", () => {
    jest.useFakeTimers();

    renderSession();

    act(() => lastSocket()?.onclose?.());
    // Give any (would-be) reconnect timer a chance to fire.
    act(() => jest.runAllTimers());

    // A dropped connection always starts an unrelated brand new shell
    // anyway, so it is treated the same as a clean exit: reported, and left
    // for the user to act on (closing and reopening the panel), rather than
    // silently replaced.
    expect(lastTerminal()?.write).toHaveBeenCalledWith(expect.stringContaining("connection lost"));
    expect(MockWebSocket.instances).toHaveLength(1);

    jest.useRealTimers();
  });

  it("disposes the terminal and closes the socket on unmount", () => {
    const { unmount } = renderSession();

    const terminal = lastTerminal();
    const socket = lastSocket();

    unmount();

    expect(terminal?.dispose).toHaveBeenCalled();
    expect(socket?.close).toHaveBeenCalled();
  });

  it("does not reconnect after being unmounted on purpose", () => {
    const { unmount } = renderSession();

    const socket = lastSocket();
    unmount();
    act(() => socket?.onclose?.());

    // Only the original socket (now closed); no reconnect attempt.
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  describe("the keyboard escape hatch", () => {
    const keydown = (key: string, modifiers: KeyboardEventInit = {}) =>
      new KeyboardEvent("keydown", { key, cancelable: true, ...modifiers });
    const leaveShortcut = () => keydown("L", { ctrlKey: true, shiftKey: true });

    const renderWithOnLeave = (onLeave: () => void) => {
      renderHook(() => useTerminalSession(null, { onLeave }));
      return lastTerminal()?.keyEventHandler;
    };

    it("leaves the terminal when Ctrl+Shift+L is pressed", () => {
      const onLeave = jest.fn();
      const handleKey = renderWithOnLeave(onLeave);

      const shortcut = leaveShortcut();
      // The key is neither handled by the terminal nor left to the browser.
      expect(handleKey?.(shortcut)).toBe(false);
      expect(shortcut.defaultPrevented).toBe(true);
      expect(onLeave).toHaveBeenCalled();
    });

    it.each([
      ["Ctrl+L", keydown("l", { ctrlKey: true })],
      ["Shift+L", keydown("L", { shiftKey: true })],
      ["Ctrl+Alt+Shift+L", keydown("L", { ctrlKey: true, altKey: true, shiftKey: true })],
      ["Tab", keydown("Tab")],
    ])("leaves %s to the terminal", (_name, event) => {
      const onLeave = jest.fn();
      const handleKey = renderWithOnLeave(onLeave);

      expect(handleKey?.(event)).toBe(true);
      expect(event.defaultPrevented).toBe(false);
      expect(onLeave).not.toHaveBeenCalled();
    });

    it("does not restart the session when the callback changes on a rerender", () => {
      const { rerender } = renderHook(({ onLeave }) => useTerminalSession(null, { onLeave }), {
        initialProps: { onLeave: jest.fn() },
      });

      const onLeave = jest.fn();
      rerender({ onLeave });

      expect(terminalInstances()).toHaveLength(1);

      const handleKey = lastTerminal()?.keyEventHandler;
      handleKey?.(leaveShortcut());

      expect(onLeave).toHaveBeenCalled();
    });
  });

  it("starts a brand new session if mounted again after being closed", () => {
    const { unmount } = renderSession();

    unmount();

    renderSession();

    expect(terminalInstances()).toHaveLength(2);
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
