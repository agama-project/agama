/*
 * Copyright (c) [2022-2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { installerRender } from "~/test-utils";
import { createClient } from "~/client";

import { RootPasswordPopup } from "~/components/users";

jest.mock("~/client");

const onCloseCallback = jest.fn();
const setRootPasswordFn = jest.fn();
const password = "nots3cr3t";

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      users: {
        setRootPassword: setRootPasswordFn,
      }
    };
  });
});

describe("when it is closed", () => {
  it("renders nothing", async () => {
    const { container } = installerRender(<RootPasswordPopup />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe("when it is open", () => {
  it("renders default title when none if given", async () => {
    installerRender(<RootPasswordPopup isOpen />);
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByText("Root password");
  });

  it("renders the given title", async () => {
    installerRender(<RootPasswordPopup isOpen title="Change The Root Password" />);
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByText("Change The Root Password");
  });

  it("allows changing the password", async () => {
    const { user } = installerRender(<RootPasswordPopup isOpen onClose={onCloseCallback} />);

    await screen.findByRole("dialog");

    const passwordInput = await screen.findByLabelText("Password");
    const passwordConfirmationInput = await screen.findByLabelText("Password confirmation");
    const confirmButton = await screen.findByRole("button", { name: /Confirm/i });

    expect(confirmButton).toBeDisabled();
    await user.type(passwordInput, password);
    expect(confirmButton).toBeDisabled();
    await user.type(passwordConfirmationInput, password);
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(setRootPasswordFn).toHaveBeenCalledWith(password);
    expect(onCloseCallback).toHaveBeenCalled();
  });

  it("allows dismissing the dialog without changing the password", async () => {
    const { user } = installerRender(<RootPasswordPopup isOpen onClose={onCloseCallback} />);
    await screen.findByRole("dialog");
    const cancelButton = await screen.findByRole("button", { name: /Cancel/i });
    await user.click(cancelButton);

    expect(setRootPasswordFn).not.toHaveBeenCalled();
    expect(onCloseCallback).toHaveBeenCalled();
  });
});
