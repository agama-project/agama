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
import { screen } from "@testing-library/react";
import { mockNavigateFn, installerRender } from "~/test-utils";
import { RootAuthMethodsPage } from "~/components/users";

const mockRootUserMutation = { mutateAsync: jest.fn() };

jest.mock("~/queries/users", () => ({
  ...jest.requireActual("~/queries/users"),
  useRootUserMutation: () => mockRootUserMutation,
}));

describe("RootAuthMethodsPage", () => {
  it("allows setting a root authentication method", async () => {
    const { user } = installerRender(<RootAuthMethodsPage />);
    const passwordInput = screen.getByLabelText("Password");
    const sshKeyTextarea = screen.getByLabelText("SSH public key");
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    // There must be an upload button too (behavior not covered here);
    screen.getByRole("button", { name: "upload" });

    // The Accept button must be enable only when at least one authentication
    // method is defined
    expect(acceptButton).toHaveAttribute("disabled");

    await user.type(passwordInput, "s3cr3t");
    expect(acceptButton).not.toHaveAttribute("disabled");

    await user.clear(passwordInput);
    expect(acceptButton).toHaveAttribute("disabled");

    await user.type(sshKeyTextarea, "FAKE SSH KEY");
    expect(acceptButton).not.toHaveAttribute("disabled");

    await user.clear(sshKeyTextarea);
    expect(acceptButton).toHaveAttribute("disabled");

    await user.type(passwordInput, "s3cr3t");
    await user.type(sshKeyTextarea, "FAKE SSH KEY");
    expect(acceptButton).not.toHaveAttribute("disabled");

    // Request setting defined root method when Accept button is clicked
    await user.click(acceptButton);
    expect(mockRootUserMutation.mutateAsync).toHaveBeenCalledWith({
      password: "s3cr3t",
      passwordEncrypted: false,
      sshkey: "FAKE SSH KEY",
    });

    await user.clear(passwordInput);
    await user.click(acceptButton);
    expect(mockRootUserMutation.mutateAsync).toHaveBeenCalledWith({
      sshkey: "FAKE SSH KEY",
    });

    await user.clear(sshKeyTextarea);
    await user.type(passwordInput, "t0ps3cr3t");
    await user.click(acceptButton);
    expect(mockRootUserMutation.mutateAsync).toHaveBeenCalledWith({
      password: "t0ps3cr3t",
      passwordEncrypted: false,
    });

    // After submitting the data, it must navigates to root
    expect(mockNavigateFn).toHaveBeenCalledWith("/");
  });
});
