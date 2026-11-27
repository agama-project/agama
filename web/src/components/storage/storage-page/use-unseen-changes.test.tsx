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
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import * as ReactQuery from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";

const mockUpdatedAt = jest.fn();

/* A fresh module per test, since it keeps what was seen for the whole session. */
const load = (): typeof import("~/components/storage/storage-page/use-unseen-changes") => {
  let hook;
  jest.isolateModules(() => {
    /* The same React and query library as the test, so hooks keep working. */
    jest.doMock("react", () => React);
    jest.doMock("@tanstack/react-query", () => ({
      ...ReactQuery,
      useSuspenseQuery: () => ({ dataUpdatedAt: mockUpdatedAt() }),
    }));
    hook = jest.requireActual("~/components/storage/storage-page/use-unseen-changes");
  });
  return hook;
};

describe("useUnseenChanges", () => {
  beforeEach(() => mockUpdatedAt.mockReturnValue(100));

  it("counts the changes shown when entering the page as seen", () => {
    const { useUnseenChanges } = load();
    const { result } = renderHook(() => useUnseenChanges());

    expect(result.current.hasUnseenChanges).toBe(false);
  });

  it("reports changes arriving after the last seen ones", () => {
    const { useUnseenChanges } = load();
    const { result, rerender } = renderHook(() => useUnseenChanges());

    mockUpdatedAt.mockReturnValue(200);
    rerender();

    expect(result.current.hasUnseenChanges).toBe(true);
  });

  it("stops reporting them once marked as seen", () => {
    const { useUnseenChanges } = load();
    const { result, rerender } = renderHook(() => useUnseenChanges());

    mockUpdatedAt.mockReturnValue(200);
    rerender();
    act(() => result.current.markSeen());

    expect(result.current.hasUnseenChanges).toBe(false);
  });

  it("keeps what was seen across components", () => {
    const { useUnseenChanges } = load();
    const first = renderHook(() => useUnseenChanges());
    first.unmount();

    mockUpdatedAt.mockReturnValue(200);
    const { result } = renderHook(() => useUnseenChanges());

    expect(result.current.hasUnseenChanges).toBe(true);
  });
});
