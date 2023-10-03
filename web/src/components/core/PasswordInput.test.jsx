/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useState } from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import userEvent from "@testing-library/user-event";
import PasswordInput from "./PasswordInput";
import { _ } from "~/i18n";

describe("PasswordInput Component", () => {
  it("renders a password input", () => {
    plainRender(
      <PasswordInput
        id="password"
        name="password"
        aria-label={_("User password")}
      />
    );

    const inputField = screen.getByLabelText("User password");
    expect(inputField).toHaveAttribute("type", "password");
  });

  it("allows revealing the password", async () => {
    plainRender(
      <PasswordInput
        id="password"
        name="password"
        aria-label={_("User password")}
      />
    );

    const passwordInput = screen.getByLabelText("User password");
    const button = screen.getByRole("button");

    expect(passwordInput).toHaveAttribute("type", "password");
    await userEvent.click(button);
    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("applies autoFocus behavior correctly", () => {
    plainRender(
      <PasswordInput
        autoFocus
        id="password"
        name="password"
        aria-label={_("User password")}
      />
    );

    const inputField = screen.getByLabelText("User password");
    expect(document.activeElement).toBe(inputField);
  });

  // Using a controlled component for testing the rendered result instead of testing if
  // the given onChange callback is called. The former is more aligned with the
  // React Testing Library principles, https://testing-library.com/docs/guiding-principles/
  const PasswordInputTest = (props) => {
    const [password, setPassword] = useState(null);

    return (
      <>
        <PasswordInput {...props} onChange={(_, v) => setPassword(v)} />
        {password && <p>Password value updated!</p>}
      </>
    );
  };

  it("triggers onChange callback", async () => {
    const { user } = plainRender(<PasswordInputTest id="test-password" aria-label="Test password" />);
    const passwordInput = screen.getByLabelText("Test password");

    expect(screen.queryByText("Password value updated!")).toBeNull();
    await user.type(passwordInput, "secret");

    screen.getByText("Password value updated!");
  });
});
