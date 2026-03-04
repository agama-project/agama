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

import { renderHook } from "@testing-library/react";
import { mockProgresses } from "~/test-utils";
import type { Progress } from "~/model/status";
import { useProgress } from "./progress";

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

describe("useProgress", () => {
  beforeEach(() => {
    mockProgresses([fakeStorageProgress, fakeSoftwareProgress]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns all progresses when no scope is provided", () => {
    const { result } = renderHook(() => useProgress());

    expect(result.current).toEqual([fakeStorageProgress, fakeSoftwareProgress]);
  });

  it("returns the progress matching the given scope", () => {
    const { result } = renderHook(() => useProgress("software"));

    expect(result.current).toBe(fakeSoftwareProgress);
  });

  it("returns undefined when the given scope has no progress", () => {
    const { result } = renderHook(() => useProgress("network"));

    expect(result.current).toBeUndefined();
  });
});
