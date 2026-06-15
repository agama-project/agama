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

import React from "react";
import { act, renderHook } from "@testing-library/react";
import { TerminalProvider, useTerminal } from "~/context/terminal";

const wrapper = ({ children }: React.PropsWithChildren) => (
  <TerminalProvider>{children}</TerminalProvider>
);

describe("useTerminal", () => {
  it("starts hidden and expanded", () => {
    const { result } = renderHook(() => useTerminal(), { wrapper });
    expect(result.current.isVisible).toBe(false);
    expect(result.current.isMinimized).toBe(false);
  });

  it("shows, hides and toggles the panel", () => {
    const { result } = renderHook(() => useTerminal(), { wrapper });

    act(() => result.current.show());
    expect(result.current.isVisible).toBe(true);

    act(() => result.current.hide());
    expect(result.current.isVisible).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.isVisible).toBe(true);
  });

  it("minimizes and restores while staying visible", () => {
    const { result } = renderHook(() => useTerminal(), { wrapper });

    act(() => result.current.show());
    act(() => result.current.minimize());
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isMinimized).toBe(true);

    act(() => result.current.restore());
    expect(result.current.isMinimized).toBe(false);
  });

  it("reopens expanded after having been minimized", () => {
    const { result } = renderHook(() => useTerminal(), { wrapper });

    act(() => result.current.show());
    act(() => result.current.minimize());
    act(() => result.current.hide());
    act(() => result.current.show());

    expect(result.current.isVisible).toBe(true);
    expect(result.current.isMinimized).toBe(false);
  });

  it("throws when used outside its provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTerminal())).toThrow(/TerminalProvider/);
    spy.mockRestore();
  });
});
