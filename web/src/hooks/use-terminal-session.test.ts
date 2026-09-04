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
    open = jest.fn((container: HTMLElement) => {
      this.element = container;
    });

    write = jest.fn();
    clear = jest.fn();
    dispose = jest.fn();
    loadAddon = jest.fn();

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

beforeEach(() => {
  (Terminal as unknown as { instances: unknown[] }).instances = [];
  (FitAddon as unknown as { instances: unknown[] }).instances = [];
  MockWebSocket.instances = [];
  (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
});

describe("useTerminalSession", () => {
  it("creates a terminal and connects a socket to the terminal endpoint on mount", () => {
    renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    expect(terminalInstances()).toHaveLength(1);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(lastSocket()?.url).toMatch(/\/api\/terminal\/ws$/);
  });

  it("does not create a second session on rerender", () => {
    const { rerender } = renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    rerender({ container: null });

    expect(terminalInstances()).toHaveLength(1);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("opens the terminal once a container becomes available", () => {
    const { rerender } = renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    expect(lastTerminal()?.open).not.toHaveBeenCalled();

    const container = document.createElement("div");
    rerender({ container });

    expect(lastTerminal()?.open).toHaveBeenCalledWith(container);
    expect(lastFitAddon()?.fit).toHaveBeenCalled();
  });

  it("forwards typed data to the socket as a binary frame", () => {
    renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    act(() => lastTerminal()?.onDataCallback?.("echo hi"));

    expect(lastSocket()?.send).toHaveBeenCalledWith(new TextEncoder().encode("echo hi"));
  });

  it("sends a resize as a JSON text frame", () => {
    renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    act(() => lastTerminal()?.onResizeCallback?.({ cols: 100, rows: 30 }));

    expect(lastSocket()?.send).toHaveBeenCalledWith(JSON.stringify({ cols: 100, rows: 30 }));
  });

  it("writes incoming binary frames to the terminal", () => {
    renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    const bytes = new TextEncoder().encode("hello from the shell");
    act(() => lastSocket()?.onmessage?.({ data: bytes.buffer }));

    expect(lastTerminal()?.write).toHaveBeenCalledWith(new Uint8Array(bytes.buffer));
  });

  it("shows a message when the server reports the shell exited", () => {
    renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    act(() => lastSocket()?.onmessage?.({ data: JSON.stringify({ type: "exit", code: 7 }) }));

    expect(lastTerminal()?.write).toHaveBeenCalledWith(expect.stringContaining("code 7"));
  });

  it("opens a new socket automatically, after a backoff delay, if the connection drops unexpectedly", () => {
    jest.useFakeTimers();

    renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => lastSocket()?.onclose?.());

    // Not reconnected immediately: it waits out the backoff delay first.
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => jest.runOnlyPendingTimers());

    expect(MockWebSocket.instances).toHaveLength(2);
    // The same terminal instance (and its scrollback) is reused.
    expect(terminalInstances()).toHaveLength(1);

    jest.useRealTimers();
  });

  it("increases the reconnect delay on repeated failures and resets it after a successful connection", () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    act(() => lastSocket()?.onclose?.());
    const firstDelay = setTimeoutSpy.mock.calls.at(-1)?.[1];

    act(() => jest.runOnlyPendingTimers());
    act(() => lastSocket()?.onclose?.());
    const secondDelay = setTimeoutSpy.mock.calls.at(-1)?.[1];

    expect(secondDelay).toBeGreaterThan(firstDelay as number);

    act(() => jest.runOnlyPendingTimers());
    // A successful connection resets the backoff for the next failure.
    act(() => lastSocket()?.onopen?.());
    act(() => lastSocket()?.onclose?.());
    const delayAfterSuccess = setTimeoutSpy.mock.calls.at(-1)?.[1];

    expect(delayAfterSuccess).toBe(firstDelay);

    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  it("disposes the terminal and closes the socket on unmount", () => {
    const { unmount } = renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    const terminal = lastTerminal();
    const socket = lastSocket();

    unmount();

    expect(terminal?.dispose).toHaveBeenCalled();
    expect(socket?.close).toHaveBeenCalled();
  });

  it("does not reconnect after being unmounted on purpose", () => {
    const { unmount } = renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    const socket = lastSocket();
    unmount();
    act(() => socket?.onclose?.());

    // Only the original socket (now closed); no reconnect attempt.
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("starts a brand new session if mounted again after being closed", () => {
    const { unmount } = renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    unmount();

    renderHook(({ container }) => useTerminalSession(container), {
      initialProps: { container: null as HTMLElement | null },
    });

    expect(terminalInstances()).toHaveLength(2);
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
