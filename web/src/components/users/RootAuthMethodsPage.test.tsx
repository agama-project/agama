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

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/queries/users", () => ({
  ...jest.requireActual("~/queries/users"),
  useRootUserMutation: () => mockRootUserMutation,
}));

describe("RootAuthMethodsPage", () => {
  it("allows setting a root password", async () => {
    const { user } = installerRender(<RootAuthMethodsPage />);
    const passwordInput = screen.getByLabelText("Password for root user");
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    // The Accept button must be enable only when password has some value
    expect(acceptButton).toHaveAttribute("disabled");

    await user.type(passwordInput, "s3cr3t");
    expect(acceptButton).not.toHaveAttribute("disabled");

    await user.clear(passwordInput);
    expect(acceptButton).toHaveAttribute("disabled");

    await user.type(passwordInput, "t0ps3cr3t");

    // Request setting root password  when Accept button is clicked
    await user.click(acceptButton);
    expect(mockRootUserMutation.mutateAsync).toHaveBeenCalledWith({
      password: "t0ps3cr3t",
      encryptedPassword: false,
    });

    // After submitting the data, it must navigate
    expect(mockNavigateFn).toHaveBeenCalled();
  });
});
