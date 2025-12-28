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

import { renderHook, waitFor } from "@testing-library/react";
import { useProgressTracking } from "./use-progress-tracking";
import { useStatus } from "~/hooks/model/status";
import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";
import { COMMON_PROPOSAL_KEYS } from "~/hooks/model/proposal";
import type { Progress } from "~/model/status";
import { act } from "react";

const mockProgressesFn: jest.Mock<Progress[]> = jest.fn();

jest.mock("~/hooks/use-track-queries-refetch");

jest.mock("~/hooks/model/status", () => ({
  ...jest.requireActual("~/hooks/model/status"),
  useStatus: (): ReturnType<typeof useStatus> => ({
    stage: "configuring",
    progresses: mockProgressesFn(),
  }),
}));

const fakeProgress: Progress = {
  index: 1,
  scope: "software",
  size: 3,
  steps: ["one", "two", "three"],
  step: "two",
};

describe("useProgressTracking", () => {
  let mockStartTracking: jest.Mock;
  let mockRefetchCallback: (startedAt: number, completedAt: number) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStartTracking = jest.fn();

    // Capture the callback passed to useTrackQueriesRefetch
    (useTrackQueriesRefetch as jest.Mock).mockImplementation((_, callback) => {
      mockRefetchCallback = callback;
      return { startTracking: mockStartTracking };
    });

    mockProgressesFn.mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("uses COMMON_PROPOSAL_KEYS by default", () => {
    renderHook(() => useProgressTracking("software"));

    expect(useTrackQueriesRefetch).toHaveBeenCalledWith(COMMON_PROPOSAL_KEYS, expect.any(Function));
  });

  it("returns loading false when there is no active progress", () => {
    const { result } = renderHook(() => useProgressTracking("software"));

    expect(result.current.loading).toBe(false);
    expect(result.current.progress).toBeUndefined();
  });

  it("returns loading true when progress starts", () => {
    mockProgressesFn.mockReturnValue([fakeProgress]);
    const { result } = renderHook(() => useProgressTracking("software"));

    expect(result.current.loading).toBe(true);
    expect(result.current.progress).toBe(fakeProgress);
  });

  it("keeps loading true until all queries refetch after progress completes", async () => {
    const { result, rerender } = renderHook(() => useProgressTracking("software"));

    // Start progress
    mockProgressesFn.mockReturnValue([fakeProgress]);
    rerender();

    // Complete progress
    jest.setSystemTime(1000);
    mockProgressesFn.mockReturnValue([]);
    rerender();

    await waitFor(() => {
      expect(mockStartTracking).toHaveBeenCalledTimes(1);
    });

    expect(result.current.loading).toBe(true);

    // Queries refetch after progress finished
    jest.setSystemTime(2000);

    act(() => {
      mockRefetchCallback(1000, 2000);
    });

    expect(result.current.loading).toBe(false);
  });

  it("ignores query refetches completed before progress finished", async () => {
    const { result, rerender } = renderHook(() => useProgressTracking("software"));

    // Start progress
    mockProgressesFn.mockReturnValue([fakeProgress]);
    rerender();

    // Complete progress
    jest.setSystemTime(2000);
    mockProgressesFn.mockReturnValue([]);
    rerender();

    await waitFor(() => {
      expect(mockStartTracking).toHaveBeenCalled();
    });

    // Queries refetched before progress finished, must be ignored
    act(() => {
      mockRefetchCallback(500, 1000);
    });

    expect(result.current.loading).toBe(true);
  });
});
