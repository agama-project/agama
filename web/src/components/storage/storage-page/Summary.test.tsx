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
import { screen } from "@testing-library/react";
import { getAnnouncements, installerRender } from "~/test-utils";
import type { Storage as Proposal } from "~/model/proposal";
import Summary from "~/components/storage/storage-page/Summary";

const mockActions = jest.fn();
const mockHasUnseenChanges = jest.fn();

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useActions: () => mockActions(),
}));

jest.mock("~/components/storage/storage-page/use-unseen-changes", () => ({
  useUnseenChanges: () => ({ hasUnseenChanges: mockHasUnseenChanges(), markSeen: jest.fn() }),
}));

/* The button has its own tests. */
jest.mock("~/components/storage/storage-page/Consequences", () => ({
  ...jest.requireActual("~/components/storage/storage-page/Consequences"),
  __esModule: true,
  default: () => <button>Preview result…</button>,
}));

const action = (values: Partial<Proposal.Action> = {}): Proposal.Action => ({
  device: 1,
  text: "",
  ...values,
});

describe("Summary", () => {
  beforeEach(() => {
    mockActions.mockReturnValue([action(), action(), action()]);
    mockHasUnseenChanges.mockReturnValue(false);
  });

  it("says how many actions the configuration takes, without data loss", () => {
    installerRender(<Summary />);

    screen.getByText(/Applying the configuration will take/);
    screen.getByText("3 actions");
    screen.getByText(/with no expected data loss/);
    screen.getByRole("button", { name: "Preview result…" });
  });

  it("uses the singular for a single action", () => {
    mockActions.mockReturnValue([action()]);
    installerRender(<Summary />);

    screen.getByText("1 action");
  });

  it("sets the data loss apart when an action deletes something", () => {
    mockActions.mockReturnValue([action(), action({ delete: true })]);
    installerRender(<Summary />);

    screen.getByText("with potential data loss");
  });

  it("does not count deleted subvolumes as data loss", () => {
    mockActions.mockReturnValue([action({ delete: true, subvol: true })]);
    installerRender(<Summary />);

    screen.getByText(/with no expected data loss/);
  });

  describe("announcements", () => {
    it("says nothing on the first render", () => {
      installerRender(<Summary />);

      expect(getAnnouncements()).toEqual([]);
    });

    it("says nothing when only the count changes", () => {
      const { rerender } = installerRender(<Summary />);
      mockActions.mockReturnValue([action(), action()]);
      rerender(<Summary />);

      expect(getAnnouncements()).toEqual([]);
    });

    it("reads the summary when the setup starts losing data", () => {
      const { rerender } = installerRender(<Summary />);
      mockActions.mockReturnValue([action(), action({ delete: true })]);
      rerender(<Summary />);

      expect(getAnnouncements()).toEqual([
        "Applying the configuration will take 2 actions during final installation, with potential data loss.",
      ]);
    });

    it("says once that the planned changes differ from the reviewed ones", () => {
      const { rerender } = installerRender(<Summary />);
      mockHasUnseenChanges.mockReturnValue(true);
      rerender(<Summary />);
      rerender(<Summary />);

      expect(getAnnouncements()).toEqual([
        "The planned changes are different since you last reviewed them.",
      ]);
    });
  });
});
