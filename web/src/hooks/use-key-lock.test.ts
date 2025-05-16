/*
 * Copyright (c) [2025] SUSE LLC
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

import { fireEvent, renderHook } from "@testing-library/react";
import { useKeyLock } from "./use-key-lock";

describe("useKeyLock", () => {
  it("detects CapsLock changes", () => {
    const { result } = renderHook(() => useKeyLock("CapsLock"));
    expect(result.current).toBe(false);

    // Does not change when triggering different key
    fireEvent.keyDown(window, { key: "NumLock" });
    expect(result.current).toBe(false);

    fireEvent.keyDown(window, { key: "CapsLock" });
    expect(result.current).toBe(true);

    fireEvent.keyDown(window, { key: "CapsLock" });
    expect(result.current).toBe(false);
  });

  it("detects NumLock changes", () => {
    const { result } = renderHook(() => useKeyLock("NumLock"));
    expect(result.current).toBe(false);

    // Does not change when triggering different key
    fireEvent.keyDown(window, { key: "CapsLock" });
    expect(result.current).toBe(false);

    fireEvent.keyDown(window, { key: "NumLock" });
    expect(result.current).toBe(true);

    fireEvent.keyDown(window, { key: "NumLock" });
    expect(result.current).toBe(false);
  });

  it("detects ScrollLock changes", () => {
    const { result } = renderHook(() => useKeyLock("ScrollLock"));
    expect(result.current).toBe(false);

    // Does not change when triggering different key
    fireEvent.keyDown(window, { key: "CapsLock" });
    expect(result.current).toBe(false);

    fireEvent.keyDown(window, { key: "ScrollLock" });
    expect(result.current).toBe(true);

    fireEvent.keyDown(window, { key: "ScrollLock" });
    expect(result.current).toBe(false);
  });
});
