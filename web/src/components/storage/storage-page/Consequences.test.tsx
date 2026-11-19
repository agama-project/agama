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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import type { Storage as Proposal } from "~/model/proposal";
import Consequences from "~/components/storage/storage-page/Consequences";

const mockActions = jest.fn();

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useActions: () => mockActions(),
}));

const mockHasUnseenChanges = jest.fn();

jest.mock("~/components/storage/storage-page/use-unseen-changes", () => ({
  useUnseenChanges: () => ({ hasUnseenChanges: mockHasUnseenChanges(), markSeen: jest.fn() }),
}));

jest.mock("~/components/storage/storage-page/PlannedChangesPopup", () => () => (
  <div>the final layout and every action</div>
));

const action = (device: number, values: Partial<Proposal.Action> = {}): Proposal.Action => ({
  device,
  text: "",
  ...values,
});

/** The summary sentence, read as a whole. */
const details = () => screen.getByRole("button", { name: "Details…" });
const openPopup = async (user) => {
  await user.click(details());
  return screen.getByRole("dialog", { name: "Planned storage changes" });
};

describe("Consequences", () => {
  beforeEach(() => {
    mockActions.mockReturnValue([]);
    mockHasUnseenChanges.mockReturnValue(false);
  });

  it("offers one way to the planned changes", () => {
    installerRender(<Consequences />);

    details();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says when the planned changes differ from the ones last seen", () => {
    mockHasUnseenChanges.mockReturnValue(true);
    installerRender(<Consequences aria-label="Details of the planned storage changes" />);

    screen.getByRole("button", { name: "Details of the planned storage changes (updated)" });
  });

  it("takes the words it is given", () => {
    installerRender(<Consequences label="Preview result…" aria-label="Preview the result" />);

    screen.getByRole("button", { name: "Preview the result" });
    screen.getByText("Preview result…");
  });

  it("shows the planned changes in a popup", async () => {
    const { user } = installerRender(<Consequences />);
    const popup = await openPopup(user);

    within(popup).getByText("the final layout and every action");
  });

  it("warns of data loss when an action deletes something", async () => {
    mockActions.mockReturnValue([action(1), action(2, { delete: true })]);
    const { user } = installerRender(<Consequences />);
    const popup = await openPopup(user);

    within(popup).getByText(
      "The configuration will be applied during installation with potential data loss",
    );
  });

  it("expects no data loss when nothing is deleted", async () => {
    mockActions.mockReturnValue([action(1), action(2, { resize: true })]);
    const { user } = installerRender(<Consequences />);
    const popup = await openPopup(user);

    within(popup).getByText(
      "The configuration will be applied during installation with no expected data loss",
    );
  });

  it("does not count deleted subvolumes as data loss", async () => {
    mockActions.mockReturnValue([action(1), action(2, { delete: true, subvol: true })]);
    const { user } = installerRender(<Consequences />);
    const popup = await openPopup(user);

    within(popup).getByText(
      "The configuration will be applied during installation with no expected data loss",
    );
  });
});
