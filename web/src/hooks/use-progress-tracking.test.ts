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

import { renderHook, waitFor } from "@testing-library/react";
import { mockProgresses, mockTasks } from "~/test-utils";
import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";
import type { Progress, Task } from "~/model/status";
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

const fakeSoftwareTask: Task = {
  id: 1,
  name: "software-proposal",
  description: "Calculating software proposal",
  scope: "software",
};

const fakeStorageTask: Task = {
  id: 2,
  name: "storage-probe",
  description: "Probing storage devices",
  scope: "storage",
};

describe("useProgressTracking", () => {
  let mockStartTracking: jest.Mock;
  let mockRefetchCallback: () => void;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStartTracking = jest.fn();

    // Capture the callback passed to useTrackQueriesRefetch
    (useTrackQueriesRefetch as jest.Mock).mockImplementation((_, callback) => {
      mockRefetchCallback = callback;
      return { startTracking: mockStartTracking };
    });

    // Default: no tasks
    mockTasks([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("uses empty array by default when no query keys specified", () => {
    renderHook(() => useProgressTracking("software"));

    expect(useTrackQueriesRefetch).toHaveBeenCalledWith([], expect.any(Function));
  });

  it("uses provided query keys when specified", () => {
    const queryKeys = ["proposal", "config"];
    renderHook(() => useProgressTracking("software", queryKeys));

    expect(useTrackQueriesRefetch).toHaveBeenCalledWith(queryKeys, expect.any(Function));
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
      jest.advanceTimersByTime(1000);
      mockProgresses([]);
      rerender();

      await waitFor(() => {
        expect(mockStartTracking).toHaveBeenCalledTimes(1);
      });

      expect(result.current.loading).toBe(true);

      // Queries refetch after progress finished
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        mockRefetchCallback();
        expect(result.current.loading).toBe(false);
      });
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
      jest.advanceTimersByTime(1000);
      mockProgresses([]);
      rerender();

      await waitFor(() => {
        expect(mockStartTracking).toHaveBeenCalledTimes(1);
      });

      expect(result.current.loading).toBe(true);

      // Queries refetch after progress finished
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        mockRefetchCallback();
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe("task tracking", () => {
    it("returns loading true when there are tasks for the given scope", () => {
      mockTasks([fakeSoftwareTask]);
      const { result } = renderHook(() => useProgressTracking("software"));

      expect(result.current.loading).toBe(true);
    });

    it("returns loading false when there are no tasks for the given scope", () => {
      mockTasks([fakeStorageTask]);
      const { result } = renderHook(() => useProgressTracking("software"));

      expect(result.current.loading).toBe(false);
    });

    it("returns loading true when there are multiple tasks for the same scope", () => {
      const secondSoftwareTask = { ...fakeSoftwareTask, id: 3 };
      mockTasks([fakeSoftwareTask, secondSoftwareTask, fakeStorageTask]);
      const { result } = renderHook(() => useProgressTracking("software"));

      expect(result.current.loading).toBe(true);
    });

    it("returns loading true when there are tasks and no scope is provided", () => {
      mockTasks([fakeSoftwareTask, fakeStorageTask]);
      const { result } = renderHook(() => useProgressTracking());

      expect(result.current.loading).toBe(true);
    });

    it("keeps loading true until all queries refetch after tasks complete", async () => {
      const { result, rerender } = renderHook(() => useProgressTracking("software"));

      // Start with tasks
      mockTasks([fakeSoftwareTask]);
      rerender();

      expect(result.current.loading).toBe(true);

      // Complete tasks
      jest.advanceTimersByTime(1000);
      mockTasks([]);
      rerender();

      await waitFor(() => {
        expect(mockStartTracking).toHaveBeenCalledTimes(1);
      });

      expect(result.current.loading).toBe(true);

      // Queries refetch after tasks finished
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        mockRefetchCallback();
        expect(result.current.loading).toBe(false);
      });
    });

    it("keeps loading true when both progress and tasks exist", () => {
      mockProgresses([fakeSoftwareProgress]);
      mockTasks([fakeSoftwareTask]);
      const { result } = renderHook(() => useProgressTracking("software"));

      expect(result.current.loading).toBe(true);
      expect(result.current.progress).toBe(fakeSoftwareProgress);
    });

    it("waits for refetch only after both progress and tasks complete", async () => {
      const { result, rerender } = renderHook(() => useProgressTracking("software"));

      // Start with both progress and tasks
      mockProgresses([fakeSoftwareProgress]);
      mockTasks([fakeSoftwareTask]);
      rerender();

      expect(result.current.loading).toBe(true);

      // startTracking is called when operation starts, not when it completes
      await waitFor(() => {
        expect(mockStartTracking).toHaveBeenCalledTimes(1);
      });

      // Progress completes but task still running
      jest.advanceTimersByTime(1000);
      mockProgresses([]);
      mockTasks([fakeSoftwareTask]);
      rerender();

      expect(result.current.loading).toBe(true);
      // startTracking should only be called once, even though state changed
      expect(mockStartTracking).toHaveBeenCalledTimes(1);

      // Task also completes
      jest.advanceTimersByTime(1000);
      mockTasks([]);
      rerender();

      // Still only called once
      expect(mockStartTracking).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(true);

      // Queries refetch
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        mockRefetchCallback();
        expect(result.current.loading).toBe(false);
      });
    });

    // This test verifies that startTracking() is called when progress starts,
    // not when it completes. This ensures queries that refetch during the operation
    // are properly detected as fresh by useTrackQueriesRefetch.
    //
    // The trackingRequested state prevents multiple calls to startTracking() even
    // if queries update during the operation, ensuring the startedAt timestamp
    // captured by useTrackQueriesRefetch reflects when the operation actually began.
    it("calls startTracking when progress starts, not when it completes", async () => {
      const { result, rerender } = renderHook(() => useProgressTracking("software"));

      // Before progress starts
      expect(result.current.loading).toBe(false);
      expect(mockStartTracking).not.toHaveBeenCalled();

      // Progress starts at T0
      mockProgresses([fakeSoftwareProgress]);
      rerender();

      // startTracking should be called immediately when progress starts
      await waitFor(() => {
        expect(mockStartTracking).toHaveBeenCalledTimes(1);
      });
      expect(result.current.loading).toBe(true);

      // Query refetches during progress at T+1000ms (this would happen automatically
      // in real app due to query invalidation or refetchInterval)
      jest.advanceTimersByTime(1000);
      rerender();

      // startTracking should NOT be called again despite query updates
      expect(mockStartTracking).toHaveBeenCalledTimes(1);

      // Progress completes at T+2000ms
      jest.advanceTimersByTime(1000);
      mockProgresses([]);
      rerender();

      // startTracking should still only have been called once
      expect(mockStartTracking).toHaveBeenCalledTimes(1);

      // Loading stays true until refetch callback fires
      expect(result.current.loading).toBe(true);

      // Queries finish refetching
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        mockRefetchCallback();
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
