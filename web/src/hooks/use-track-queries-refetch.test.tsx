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

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import useTrackQueriesRefetch from "./use-track-queries-refetch";

describe("useTrackQueriesRefetch", () => {
  let queryClient: QueryClient;
  let now = 0;

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    jest.spyOn(Date, "now").mockImplementation(() => now);

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    queryClient.clear();
  });

  const advanceTime = (ms = 1) => {
    now += ms;
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  };

  const renderTestHook = (queryKeys: string[], onSuccess: jest.Mock) => {
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return renderHook(
      () => {
        const client = useQueryClient();
        const tracker = useTrackQueriesRefetch(queryKeys, onSuccess);

        return {
          ...tracker,
          queryClient: client,
        };
      },
      {
        wrapper: TestWrapper,
      },
    );
  };

  it("calls onSuccess when all queries refetch", async () => {
    const onSuccess = jest.fn();

    const { result } = renderTestHook(["q1", "q2"], onSuccess);

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "initial");
      result.current.queryClient.setQueryData(["q2"], "initial");
    });

    act(() => {
      result.current.startTracking();
    });

    advanceTime();

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "updated");
      result.current.queryClient.setQueryData(["q2"], "updated");
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("calls onSuccess immediately when queryKeys is empty", async () => {
    const onSuccess = jest.fn();

    const { result } = renderTestHook([], onSuccess);

    act(() => {
      result.current.startTracking();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores updates before startTracking", async () => {
    const onSuccess = jest.fn();

    const { result } = renderTestHook(["q1", "q2"], onSuccess);

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "before");
      result.current.queryClient.setQueryData(["q2"], "before");
    });

    advanceTime(10);

    act(() => {
      result.current.startTracking();
    });

    advanceTime();

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "after");
      result.current.queryClient.setQueryData(["q2"], "after");
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("cancels previous cycle when startTracking is called again", async () => {
    const onSuccess = jest.fn();

    const { result } = renderTestHook(["q1", "q2"], onSuccess);

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "init");
      result.current.queryClient.setQueryData(["q2"], "init");
    });

    act(() => {
      result.current.startTracking();
    });

    advanceTime();

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "cycle-1");
    });

    act(() => {
      result.current.startTracking();
    });

    advanceTime();

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "cycle-2");
      result.current.queryClient.setQueryData(["q2"], "cycle-2");
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call onSuccess more than once per cycle", async () => {
    const onSuccess = jest.fn();

    const { result } = renderTestHook(["q1"], onSuccess);

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "init");
    });

    act(() => {
      result.current.startTracking();
    });

    advanceTime();

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "u1");
      result.current.queryClient.setQueryData(["q1"], "u2");
      result.current.queryClient.setQueryData(["q1"], "u3");
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("removes duplicate query keys", async () => {
    const onSuccess = jest.fn();

    const { result } = renderTestHook(["q1", "q2", "q1", "q2"], onSuccess);

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "init");
      result.current.queryClient.setQueryData(["q2"], "init");
    });

    act(() => {
      result.current.startTracking();
    });

    advanceTime();

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "u1");
      result.current.queryClient.setQueryData(["q2"], "u2");
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("handles queries that do not exist yet", async () => {
    const onSuccess = jest.fn();

    const { result } = renderTestHook(["missing"], onSuccess);

    act(() => {
      result.current.startTracking();
    });

    advanceTime();

    act(() => {
      result.current.queryClient.setQueryData(["missing"], "created-later");
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("handles very fast successive updates", async () => {
    const onSuccess = jest.fn();
    const keys = ["a", "b", "c"];

    const { result } = renderTestHook(keys, onSuccess);

    act(() => {
      keys.forEach((k) => result.current.queryClient.setQueryData([k], "init"));
    });

    act(() => {
      result.current.startTracking();
    });

    advanceTime();

    act(() => {
      keys.forEach((k) => result.current.queryClient.setQueryData([k], "update"));
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("handles queryKeys array reference changes", async () => {
    const onSuccess = jest.fn();

    const { result, rerender } = renderTestHook(["q1", "q2"], onSuccess);

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "init");
      result.current.queryClient.setQueryData(["q2"], "init");
    });

    act(() => {
      result.current.startTracking();
    });

    rerender({ keys: ["q1", "q2"] });

    advanceTime();

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "u1");
      result.current.queryClient.setQueryData(["q2"], "u2");
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("handles a large number of queries", async () => {
    const onSuccess = jest.fn();
    const keys = Array.from({ length: 50 }, (_, i) => `q${i}`);

    const { result } = renderTestHook(keys, onSuccess);

    act(() => {
      keys.forEach((k) => result.current.queryClient.setQueryData([k], "init"));
    });

    act(() => {
      result.current.startTracking();
    });

    advanceTime();

    act(() => {
      keys.forEach((k) => result.current.queryClient.setQueryData([k], "update"));
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("cleans up subscriptions on unmount", async () => {
    const onSuccess = jest.fn();

    const { result, unmount } = renderTestHook(["q1"], onSuccess);

    act(() => {
      result.current.queryClient.setQueryData(["q1"], "init");
      result.current.startTracking();
    });

    unmount();
    advanceTime();

    act(() => {
      queryClient.setQueryData(["q1"], "after");
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});
