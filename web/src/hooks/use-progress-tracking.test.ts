/*
 * Copyright (c) [2025-2026] SUSE LLC
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

import { act } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { mockProgresses } from "~/test-utils";
import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";
import { COMMON_PROPOSAL_KEYS } from "~/hooks/model/proposal";
import type { Progress } from "~/model/status";
import { useProgressTracking } from "./use-progress-tracking";

jest.mock("~/hooks/use-track-queries-refetch");

const fakeSoftwareProgress: Progress = {
  scope: "software",
  size: 3,
  steps: [
    "Updating the list of repositories",
    "Refreshing metadata from the repositories",
    "Calculating the software proposal",
  ],
  step: "Updating the list of repositories",
  index: 1,
};

const fakeStorageProgress: Progress = {
  scope: "storage",
  size: 3,
  steps: [],
  step: "Activating storage devices",
  index: 1,
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
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("uses COMMON_PROPOSAL_KEYS by default", () => {
    renderHook(() => useProgressTracking("software"));

    expect(useTrackQueriesRefetch).toHaveBeenCalledWith(COMMON_PROPOSAL_KEYS, expect.any(Function));
  });

  describe("with a specific scope", () => {
    it("returns loading false when there is no active progress", () => {
      const { result } = renderHook(() => useProgressTracking("software"));

      expect(result.current.loading).toBe(false);
      expect(result.current.progress).toBeUndefined();
    });

    it("returns loading false when there is active progress of different scope", () => {
      mockProgresses([fakeStorageProgress]);
      const { result } = renderHook(() => useProgressTracking("software"));

      expect(result.current.loading).toBe(false);
      expect(result.current.progress).toBeUndefined();
    });

    it("returns loading true when there is an active progress of gien scope", () => {
      mockProgresses([fakeSoftwareProgress]);
      const { result } = renderHook(() => useProgressTracking("software"));

      expect(result.current.loading).toBe(true);
      expect(result.current.progress).toBe(fakeSoftwareProgress);
    });

    it("keeps loading true until all queries refetch after progress completes", async () => {
      const { result, rerender } = renderHook(() => useProgressTracking("software"));

      // Start progress
      mockProgresses([fakeSoftwareProgress]);
      rerender();

      // Complete progress
      jest.setSystemTime(1000);
      mockProgresses([]);
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
      mockProgresses([fakeSoftwareProgress]);
      rerender();

      // Complete progress
      jest.setSystemTime(2000);
      mockProgresses([]);
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
  describe("without scope", () => {
    it("returns loading false when there are no active progress", () => {
      mockProgresses([]);
      const { result } = renderHook(() => useProgressTracking());

      expect(result.current.loading).toBe(false);
      expect(result.current.progress).toEqual([]);
    });

    it("returns loading true when there is an active progress", () => {
      mockProgresses([fakeSoftwareProgress]);
      const { result } = renderHook(() => useProgressTracking());

      expect(result.current.loading).toBe(true);
      expect(result.current.progress).toEqual([fakeSoftwareProgress]);
    });

    it("keeps loading true until all queries refetch after progress completes", async () => {
      const { result, rerender } = renderHook(() => useProgressTracking());

      // Start progress
      mockProgresses([fakeSoftwareProgress]);
      rerender();

      // Complete progress
      jest.setSystemTime(1000);
      mockProgresses([]);
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
      const { result, rerender } = renderHook(() => useProgressTracking());

      // Start progress
      mockProgresses([fakeSoftwareProgress]);
      rerender();

      // Complete progress
      jest.setSystemTime(2000);
      mockProgresses([]);
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
});
