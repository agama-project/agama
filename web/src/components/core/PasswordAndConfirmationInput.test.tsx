/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { installerRender } from "~/test-utils";
import PasswordAndConfirmationInput from "./PasswordAndConfirmationInput";

describe("when the passwords do not match", () => {
  it("displays a warning", async () => {
    const password = "";
    const { user } = installerRender(<PasswordAndConfirmationInput value={password} />, {
      withL10n: true,
    });

    const passwordInput = screen.getByLabelText("Password");
    user.type(passwordInput, "123456");
    await screen.findByText("Passwords do not match");
  });
});

it("uses the given password value for confirmation too", async () => {
  installerRender(<PasswordAndConfirmationInput value="12345" />, { withL10n: true });

  const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
  const confirmationInput = screen.getByLabelText("Password confirmation") as HTMLInputElement;

  expect(passwordInput.value).toEqual("12345");
  expect(passwordInput.value).toEqual(confirmationInput.value);
});

describe("when isDisabled", () => {
  it("disables both, password and confirmation", async () => {
    installerRender(<PasswordAndConfirmationInput value="12345" isDisabled />, { withL10n: true });

    const passwordInput = screen.getByLabelText("Password");
    const confirmationInput = screen.getByLabelText("Password confirmation");

    expect(passwordInput).toBeDisabled();
    expect(confirmationInput).toBeDisabled();
  });

  it("clean errors", async () => {
    const CleanErrorTest = () => {
      const [isDisabled, setIsDisabled] = React.useState(false);

      return (
        <>
          <PasswordAndConfirmationInput isDisabled={isDisabled} />
          <button onClick={() => setIsDisabled(true)}>Set as disabled</button>
        </>
      );
    };

    const { user } = installerRender(<CleanErrorTest />, { withL10n: true });
    const passwordInput = screen.getByLabelText("Password");
    user.type(passwordInput, "123456");
    await screen.findByText("Passwords do not match");
    const setAsDisabledButton = screen.getByRole("button", { name: "Set as disabled" });
    await user.click(setAsDisabledButton);
    expect(screen.queryByText("Passwords do not match")).toBeNull();
  });
});
