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
import { installerRender, mockNavigateFn } from "~/test-utils";
import type { Storage as Proposal } from "~/model/proposal";
import Consequences from "~/components/storage/storage-page/Consequences";

const mockActions = jest.fn();

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useActions: () => mockActions(),
}));

const action = (device: number, values: Partial<Proposal.Action> = {}): Proposal.Action => ({
  device,
  text: "",
  ...values,
});

/** The summary sentence, read as a whole. */
const summary = () => screen.getByText(/Applying the current configuration/);

describe("Consequences", () => {
  beforeEach(() => {
    mockActions.mockReturnValue([]);
  });

  it("says how many actions applying the configuration takes", () => {
    mockActions.mockReturnValue([action(1), action(2, { delete: true }), action(3)]);
    installerRender(<Consequences />);

    expect(summary()).toHaveTextContent("Applying the current configuration takes 3 actions.");
  });

  it("puts the number of actions in bold", () => {
    mockActions.mockReturnValue([action(1), action(2)]);
    installerRender(<Consequences />);

    expect(screen.getByText("2 actions").tagName).toBe("STRONG");
  });

  it("uses the singular for a single action", () => {
    mockActions.mockReturnValue([action(1)]);
    installerRender(<Consequences />);

    expect(summary()).toHaveTextContent("Applying the current configuration takes 1 action.");
  });

  it("does not count subvolumes", () => {
    mockActions.mockReturnValue([
      action(1),
      action(2, { subvol: true }),
      action(3, { subvol: true }),
    ]);
    installerRender(<Consequences />);

    expect(summary()).toHaveTextContent("Applying the current configuration takes 1 action.");
  });

  it("does not say what the actions destroy", () => {
    mockActions.mockReturnValue([action(1, { delete: true }), action(2, { resize: true })]);
    installerRender(<Consequences />);

    expect(screen.queryByText(/destructive|shrink/i)).toBeNull();
  });

  it("offers the final layout and the actions, in the order of the result tabs", () => {
    installerRender(<Consequences />);

    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual(["View final layout", "Check actions"]);
  });

  it("opens the result on the final layout", async () => {
    const { user } = installerRender(<Consequences />);
    await user.click(screen.getByRole("link", { name: "View final layout" }));

    expect(mockNavigateFn).toHaveBeenCalledWith(
      { search: "?sheet=result&sheetTab=layout" },
      { replace: true },
    );
  });

  it("opens the result on the actions", async () => {
    const { user } = installerRender(<Consequences />);
    await user.click(screen.getByRole("link", { name: "Check actions" }));

    expect(mockNavigateFn).toHaveBeenCalledWith(
      { search: "?sheet=result&sheetTab=actions" },
      { replace: true },
    );
  });
});
