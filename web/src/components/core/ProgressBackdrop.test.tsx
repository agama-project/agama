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
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender, mockProgresses } from "~/test-utils";
import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";
import { COMMON_PROPOSAL_KEYS } from "~/hooks/model/proposal";
import ProgressBackdrop from "./ProgressBackdrop";

const mockStartTracking: jest.Mock = jest.fn();

jest.mock("~/hooks/use-track-queries-refetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseTrackQueriesRefetch = jest.mocked(useTrackQueriesRefetch);

describe("ProgressBackdrop", () => {
  beforeEach(() => {
    // Set up default mock for useTrackQueriesRefetch
    mockUseTrackQueriesRefetch.mockReturnValue({
      startTracking: mockStartTracking,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when progress scope is provided but no matching progress exists", () => {
    it("does not render the backdrop", () => {
      installerRender(<ProgressBackdrop scope="software" />);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("when progress scope matches an active progress", () => {
    it("renders the backdrop with progress information", () => {
      mockProgresses([
        {
          scope: "software",
          step: "Installing packages",
          steps: [],
          index: 2,
          size: 5,
        },
      ]);
      installerRender(<ProgressBackdrop scope="software" />);
      const backdrop = screen.getByRole("alert", { name: /Installing packages/ });
      expect(backdrop.classList).toContain("agm-main-content-overlay");
      within(backdrop).getByText(/step 2 of 5/);
    });
  });

  describe("when progress finishes", () => {
    let mockStartTracking: jest.Mock;
    let mockCallback: (startedAt: number, completedAt: number) => void;

    beforeEach(() => {
      mockStartTracking = jest.fn();
      mockUseTrackQueriesRefetch.mockImplementation((keys, callback) => {
        mockCallback = callback;
        return { startTracking: mockStartTracking };
      });
    });

    // Test skipped because rerender fails when using installerRender,
    // caused by how InstallerProvider manages context.
    it.skip("shows 'Refreshing data...' message temporarily", async () => {
      // Start with active progress
      mockProgresses([
        {
          scope: "storage",
          step: "Calculating proposal",
          steps: ["Calculating proposal"],
          index: 1,
          size: 1,
        },
      ]);

      const { rerender } = installerRender(<ProgressBackdrop scope="storage" />);

      const backdrop = screen.getByRole("alert", { name: /Calculating proposal/ });

      // Progress finishes
      mockProgresses([]);

      rerender(<ProgressBackdrop scope="storage" />);

      // Should show "Refreshing data..." message
      await waitFor(() => {
        within(backdrop).getByText(/Refreshing data/);
      });

      // Should start tracking queries
      expect(mockStartTracking).toHaveBeenCalled();
    });

    // Test skipped because rerender fails when using installerRender,
    // caused by how InstallerProvider manages context.
    it.skip("hides backdrop after queries are refetched", async () => {
      // Start with active progress
      mockProgresses([
        {
          scope: "storage",
          step: "Calculating proposal",
          steps: ["Calculating proposal"],
          index: 1,
          size: 1,
        },
      ]);

      const { rerender } = installerRender(<ProgressBackdrop scope="storage" />);

      // Progress finishes
      mockProgresses([]);

      const backdrop = screen.getByRole("alert", { name: /Calculating proposal/ });

      rerender(<ProgressBackdrop scope="storage" />);

      // Should show refreshing message
      await waitFor(() => {
        within(backdrop).getByText(/Refreshing data/);
      });

      // Simulate queries completing by calling the callback
      const startedAt = Date.now();
      mockCallback(startedAt, startedAt + 100);

      // Backdrop should be hidden
      await waitFor(() => {
        expect(screen.queryByRole("alert")).toBeNull();
      });
    });
  });

  describe("when progress scope does not match", () => {
    it("does not show backdrop for different scope", () => {
      mockProgresses([
        {
          scope: "software",
          step: "Installing packages",
          steps: [],
          index: 2,
          size: 5,
        },
      ]);
      installerRender(<ProgressBackdrop scope="storage" />);
      expect(screen.queryByRole("alert", { name: /Installing packages/ })).toBeNull();
    });
  });

  describe("multiple progress updates", () => {
    it("updates the backdrop message when progress changes", () => {
      mockProgresses([
        {
          scope: "software",
          step: "Downloading packages",
          steps: [],
          index: 1,
          size: 5,
        },
      ]);
      const { rerender } = installerRender(<ProgressBackdrop scope="software" />);
      const backdrop = screen.getByRole("alert", { name: /Downloading packages/ });
      within(backdrop).getByText(/step 1 of 5/);

      mockProgresses([
        {
          scope: "software",
          step: "Installing packages",
          steps: [],
          index: 3,
          size: 5,
        },
      ]);
      rerender(<ProgressBackdrop scope="software" />);
      within(backdrop).getByText(/Installing packages/);
      within(backdrop).getByText(/step 3 of 5/);
    });
  });

  describe("query keys refetch tracking", () => {
    it("tracks common proposal keys by default", () => {
      mockProgresses([
        {
          scope: "software",
          step: "Installing packages",
          steps: [],
          index: 1,
          size: 3,
        },
      ]);

      installerRender(<ProgressBackdrop scope="software" />);

      // Should be called with COMMON_PROPOSAL_KEYS and undefined additionalKeys
      expect(mockUseTrackQueriesRefetch).toHaveBeenCalledWith(
        expect.arrayContaining(COMMON_PROPOSAL_KEYS),
        expect.any(Function),
      );
    });

    it("tracks additional query key along with common ones", () => {
      mockProgresses([
        {
          scope: "storage",
          step: "Calculating proposal",
          steps: [],
          index: 1,
          size: 1,
        },
      ]);

      installerRender(<ProgressBackdrop scope="storage" ensureRefetched="storageModel" />);

      // Should be called with COMMON_PROPOSAL_KEYS + storageModel
      expect(mockUseTrackQueriesRefetch).toHaveBeenCalledWith(
        expect.arrayContaining([...COMMON_PROPOSAL_KEYS, "storageModel"]),
        expect.any(Function),
      );
    });

    it("tracks multiple additional query keys along with common ones", () => {
      mockProgresses([
        {
          scope: "network",
          step: "Configuring network",
          steps: [],
          index: 1,
          size: 2,
        },
      ]);

      installerRender(
        <ProgressBackdrop scope="network" ensureRefetched={["networkConfig", "connections"]} />,
      );

      // Should be called with COMMON_PROPOSAL_KEYS + networkConfig + connections
      expect(mockUseTrackQueriesRefetch).toHaveBeenCalledWith(
        expect.arrayContaining([...COMMON_PROPOSAL_KEYS, "networkConfig", "connections"]),
        expect.any(Function),
      );
    });

    // Test skipped because rerender fails when using installerRender,
    // caused by how InstallerProvider manages context.
    it.skip("starts tracking when progress finishes", async () => {
      // Start with active progress
      mockProgresses([
        {
          scope: "storage",
          step: "Calculating proposal",
          steps: ["Calculating proposal"],
          index: 1,
          size: 1,
        },
      ]);

      const { rerender } = installerRender(
        <ProgressBackdrop scope="storage" ensureRefetched="storageModel" />,
      );

      // Progress finishes
      mockProgresses([]);

      rerender(<ProgressBackdrop scope="storage" ensureRefetched="storageModel" />);
      rerender(<ProgressBackdrop scope="storage" ensureRefetched="storageModel" />);

      // Should have called startTracking
      await waitFor(() => {
        expect(mockStartTracking).toHaveBeenCalled();
      });
    });
  });
});
