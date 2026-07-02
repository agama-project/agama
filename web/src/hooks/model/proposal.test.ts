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

import { QueryClient } from "@tanstack/react-query";
import { installerRenderHook, createCallbackMock } from "~/test-utils";

const [mockOnEvent, eventCallbacks] = createCallbackMock();

jest.mock("~/context/installer", () => ({
  useInstallerClient: () => ({ onEvent: mockOnEvent }),
}));

import { useProposalChanges } from "~/hooks/model/proposal";

const emitEvent = (event: { type: string }) => eventCallbacks.forEach((cb) => cb(event));

describe("useProposalChanges", () => {
  let invalidateSpy: jest.SpyInstance;

  // Returns the first segment of every query key passed to invalidateQueries.
  const invalidatedKeys = () => invalidateSpy.mock.calls.map(([filters]) => filters.queryKey[0]);

  beforeEach(() => {
    eventCallbacks.length = 0;
    invalidateSpy = jest
      .spyOn(QueryClient.prototype, "invalidateQueries")
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("invalidates the proposal-related queries on a ProposalChanged event", () => {
    installerRenderHook(() => useProposalChanges());

    emitEvent({ type: "ProposalChanged" });

    // A proposal change must invalidate these four queries so they refetch.
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining(["proposal", "extendedConfig", "config", "storageModel"]),
    );
    // Every key must be a real string. The bug this test guards against left one
    // key as undefined, so the loop invalidated nothing.
    expect(invalidatedKeys()).not.toContain(undefined);
  });

  it("ignores events other than ProposalChanged", () => {
    installerRenderHook(() => useProposalChanges());

    emitEvent({ type: "SomethingElse" });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("stops listening when unmounted", () => {
    const { unmount } = installerRenderHook(() => useProposalChanges());
    expect(eventCallbacks).toHaveLength(1);

    unmount();

    expect(eventCallbacks).toHaveLength(0);
  });
});
