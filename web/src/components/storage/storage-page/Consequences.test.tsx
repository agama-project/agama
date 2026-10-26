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

jest.mock("~/components/storage/storage-page/PlannedChangesPopup", () => () => (
  <div>the final layout and every action</div>
));

const action = (device: number, values: Partial<Proposal.Action> = {}): Proposal.Action => ({
  device,
  text: "",
  ...values,
});

/** The summary sentence, read as a whole. */
const summary = () => screen.getByText(/Applying the configuration below/);
const viewChanges = () => screen.getByRole("button", { name: "View changes" });

describe("Consequences", () => {
  beforeEach(() => {
    mockActions.mockReturnValue([]);
  });

  it("says how many actions applying the configuration takes", () => {
    mockActions.mockReturnValue([action(1), action(2, { delete: true }), action(3)]);
    installerRender(<Consequences />);

    expect(summary()).toHaveTextContent(
      "Applying the configuration below will take 3 actions during installation.",
    );
  });

  it("uses the singular for a single action", () => {
    mockActions.mockReturnValue([action(1)]);
    installerRender(<Consequences />);

    expect(summary()).toHaveTextContent(
      "Applying the configuration below will take 1 action during installation.",
    );
  });

  it("does not count subvolumes", () => {
    mockActions.mockReturnValue([
      action(1),
      action(2, { subvol: true }),
      action(3, { subvol: true }),
    ]);
    installerRender(<Consequences />);

    expect(summary()).toHaveTextContent(
      "Applying the configuration below will take 1 action during installation.",
    );
  });

  it("does not say what the actions destroy", () => {
    mockActions.mockReturnValue([action(1, { delete: true }), action(2, { resize: true })]);
    installerRender(<Consequences />);

    expect(screen.queryByText(/destructive|shrink/i)).toBeNull();
  });

  it("offers one way to the changes, at the end of the sentence", () => {
    installerRender(<Consequences />);

    expect(summary()).toContainElement(viewChanges());
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the planned changes in a popup", async () => {
    const { user } = installerRender(<Consequences />);
    await user.click(viewChanges());

    const popup = screen.getByRole("dialog", { name: "Planned storage changes" });
    within(popup).getByText("Result of applying the current storage configuration to the system");
    within(popup).getByText("the final layout and every action");
  });
});
