/*
 * Copyright (c) [2024] SUSE LLC
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
import { plainRender } from "~/test-utils";

import InitiatorPresenter from "./InitiatorPresenter";
import { ISCSIInitiator } from "~/types/storage";

const initiator: ISCSIInitiator = {
  name: "iqn.1996-04.de.suse:01:62b45cf7fc",
  ibft: true,
  offloadCard: "",
};

const mockInitiatorMutation = { mutateAsync: jest.fn() };

jest.mock("~/queries/storage/iscsi", () => ({
  ...jest.requireActual("~/queries/storage/iscsi"),
  useInitiatorMutation: () => mockInitiatorMutation,
}));

describe("InitiatorPresenter", () => {
  it("displays the initiator data", () => {
    plainRender(<InitiatorPresenter initiator={initiator} />);
    screen.getByText(initiator.name);
    screen.getByRole("cell", { name: initiator.name });
  });

  it("updates the initiator data", async () => {
    const { user } = plainRender(<InitiatorPresenter initiator={initiator} />);

    const button = await screen.findByRole("button", { name: "Actions" });
    await user.click(button);

    const editButton = await screen.findByRole("menuitem", { name: "Edit" });
    await user.click(editButton);

    const dialog = await screen.findByRole("dialog");
    const nameInput = await within(dialog).findByLabelText(/Name/);
    await user.clear(nameInput);
    await user.type(nameInput, "my-initiator");
    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    await user.click(confirmButton);

    expect(mockInitiatorMutation.mutateAsync).toHaveBeenCalledWith({ name: "my-initiator" });
  });
});
