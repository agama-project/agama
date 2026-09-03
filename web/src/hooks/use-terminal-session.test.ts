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
// most tests only care about the terminal *context*, not the real session.
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
  it("does not create a terminal nor a socket while closed", () => {
    renderHook(({ isOpen }) => useTerminalSession(isOpen), { initialProps: { isOpen: false } });

    expect((Terminal as unknown as { instances: unknown[] }).instances).toHaveLength(0);
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("creates a terminal and connects a socket to the terminal endpoint when opened", () => {
    const { rerender } = renderHook(({ isOpen }) => useTerminalSession(isOpen), {
      initialProps: { isOpen: false },
    });

    rerender({ isOpen: true });

    expect((Terminal as unknown as { instances: unknown[] }).instances).toHaveLength(1);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(lastSocket()?.url).toMatch(/\/api\/terminal\/ws$/);
  });

  it("does not create a second session while already open", () => {
    const { rerender } = renderHook(({ isOpen }) => useTerminalSession(isOpen), {
      initialProps: { isOpen: true },
    });

    rerender({ isOpen: true });

    expect((Terminal as unknown as { instances: unknown[] }).instances).toHaveLength(1);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("opens the terminal into the attached container", () => {
    const { result } = renderHook(({ isOpen }) => useTerminalSession(isOpen), {
      initialProps: { isOpen: true },
    });

    const container = document.createElement("div");
    act(() => result.current.attach(container));

    expect(lastTerminal()?.open).toHaveBeenCalledWith(container);
    expect(lastFitAddon()?.fit).toHaveBeenCalled();
  });

  it("forwards typed data to the socket as a binary frame", () => {
    renderHook(({ isOpen }) => useTerminalSession(isOpen), { initialProps: { isOpen: true } });

    act(() => lastTerminal()?.onDataCallback?.("echo hi"));

    expect(lastSocket()?.send).toHaveBeenCalledWith(new TextEncoder().encode("echo hi"));
  });

  it("sends a resize as a JSON text frame", () => {
    renderHook(({ isOpen }) => useTerminalSession(isOpen), { initialProps: { isOpen: true } });

    act(() => lastTerminal()?.onResizeCallback?.({ cols: 100, rows: 30 }));

    expect(lastSocket()?.send).toHaveBeenCalledWith(JSON.stringify({ cols: 100, rows: 30 }));
  });

  it("writes incoming binary frames to the terminal", () => {
    renderHook(({ isOpen }) => useTerminalSession(isOpen), { initialProps: { isOpen: true } });

    const bytes = new TextEncoder().encode("hello from the shell");
    act(() => lastSocket()?.onmessage?.({ data: bytes.buffer }));

    expect(lastTerminal()?.write).toHaveBeenCalledWith(new Uint8Array(bytes.buffer));
  });

  it("shows a message when the server reports the shell exited", () => {
    renderHook(({ isOpen }) => useTerminalSession(isOpen), { initialProps: { isOpen: true } });

    act(() => lastSocket()?.onmessage?.({ data: JSON.stringify({ type: "exit", code: 7 }) }));

    expect(lastTerminal()?.write).toHaveBeenCalledWith(expect.stringContaining("code 7"));
  });

  it("opens a new socket automatically if the connection drops unexpectedly", () => {
    renderHook(({ isOpen }) => useTerminalSession(isOpen), { initialProps: { isOpen: true } });

    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => lastSocket()?.onclose?.());

    expect(MockWebSocket.instances).toHaveLength(2);
    // The same terminal instance (and its scrollback) is reused.
    expect((Terminal as unknown as { instances: unknown[] }).instances).toHaveLength(1);
  });

  it("disposes the terminal and closes the socket when closed", () => {
    const { rerender } = renderHook(({ isOpen }) => useTerminalSession(isOpen), {
      initialProps: { isOpen: true },
    });

    const terminal = lastTerminal();
    const socket = lastSocket();

    rerender({ isOpen: false });

    expect(terminal?.dispose).toHaveBeenCalled();
    expect(socket?.close).toHaveBeenCalled();
  });

  it("does not reconnect after being closed on purpose", () => {
    const { rerender } = renderHook(({ isOpen }) => useTerminalSession(isOpen), {
      initialProps: { isOpen: true },
    });

    const socket = lastSocket();
    rerender({ isOpen: false });
    act(() => socket?.onclose?.());

    // Only the original socket (now closed); no reconnect attempt.
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("starts a brand new session if reopened after being closed", () => {
    const { rerender } = renderHook(({ isOpen }) => useTerminalSession(isOpen), {
      initialProps: { isOpen: true },
    });

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    expect((Terminal as unknown as { instances: unknown[] }).instances).toHaveLength(2);
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
