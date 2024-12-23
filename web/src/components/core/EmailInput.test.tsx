/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import React, { useState } from "react";
import { screen } from "@testing-library/react";

import EmailInput, { EmailInputProps } from "./EmailInput";
import { plainRender } from "~/test-utils";

/**
 * Controlled component for testing the EmailInputProps
 *
 * Instead of testing if given callbacks are called, below tests are going to
 * check the rendered result to be more aligned with the React Testing Library
 * principles, https://testing-library.com/docs/guiding-principles/
 *
 */
const EmailInputTest = (props: EmailInputProps) => {
  const [email, setEmail] = useState("");
  const [isValid, setIsValid] = useState(true);

  return (
    <>
      <EmailInput
        {...props}
        value={email}
        onChange={(_, v) => setEmail(v)}
        onValidate={setIsValid}
      />
      {email && <p>Email value updated!</p>}
      {isValid === false && <p>Email is not valid!</p>}
    </>
  );
};

describe("EmailInput component", () => {
  it("renders an email input", () => {
    plainRender(
      <EmailInput id="email" name="email" aria-label="User email" value="test@test.com" />,
    );

    const inputField = screen.getByRole("textbox", { name: "User email" });
    expect(inputField).toHaveAttribute("type", "email");
  });

  it("triggers onChange callback", async () => {
    const { user } = plainRender(<EmailInputTest id="test-email" aria-label="Test email" />);
    const emailInput = screen.getByRole("textbox", { name: "Test email" });

    expect(screen.queryByText("Email value updated!")).toBeNull();

    await user.type(emailInput, "test@test.com");
    screen.getByText("Email value updated!");
  });

  it("triggers onValidate callback", async () => {
    const { user } = plainRender(<EmailInputTest id="test-email" aria-label="Test email" />);
    const emailInput = screen.getByRole("textbox", { name: "Test email" });

    expect(screen.queryByText("Email is not valid!")).toBeNull();

    await user.type(emailInput, "foo");
    await screen.findByText("Email is not valid!");
  });

  it("marks the input as invalid if the value is not a valid email", async () => {
    const { user } = plainRender(<EmailInputTest id="test-email" aria-label="Test email" />);
    const emailInput = screen.getByRole("textbox", { name: "Test email" });

    await user.type(emailInput, "foo");

    expect(emailInput).toHaveAttribute("aria-invalid");
  });
});
