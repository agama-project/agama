/*
 * Copyright (c) [2022] SUSE LLC
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
import { screen, fireEvent } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import userEvent from "@testing-library/user-event";
import PasswordInput from "./PasswordInput";
import { _ } from "~/i18n";

describe("PasswordInput Component", () => {
  it("has initial state for password visibility as false", () => {
    plainRender(
      <PasswordInput
        id="password"
        name="password"
        label={_("Password")}
        fieldId="password"
        ariaLabel={_("User password")}
      />
    );
    const inputField = screen.getByLabelText("Password");
    expect(inputField).toHaveAttribute("type", "password");
  });

  it("after user clicks the eye icon type switches from password to text", async () => {
    plainRender(
      <PasswordInput
        id="password"
        name="password"
        label={_("Password")}
        fieldId="password"
        ariaLabel={_("User password")}
      />
    );

    const passwordInput = screen.getByLabelText("Password");
    const button = screen.getByRole("button");

    expect(passwordInput).toHaveAttribute("type", "password");
    await userEvent.click(button);
    expect(passwordInput).toHaveAttribute("type", "text")
  });

  it("can be disabled", () => {
    plainRender(
      <PasswordInput
        id="password"
        name="password"
        label={_("Password")}
        fieldId="password"
        ariaLabel={_("User password")}
        isDisabled={true}
      />
    );
    const inputField = screen.getByLabelText("Password");
    const visibilityButton = screen.getByRole("button");

    expect(inputField).toBeDisabled();
    expect(visibilityButton).toBeDisabled();
  });

  it("applies autoFocus behavior correctly", () => {
    plainRender(
      <PasswordInput
        autoFocus
        id="password"
        name="password"
        label={_("Password")}
        fieldId="password"
        ariaLabel={_("User password")}
      />
    );
    const inputField = screen.getByLabelText("Password");

    expect(document.activeElement).toBe(inputField);
  });

  it("displays helper text for invalid input", () => {
    plainRender(
      <PasswordInput
        id="password"
        name="password"
        label={_("Password")}
        fieldId="password"
        ariaLabel={_("User password")}
        helperTextInvalid="Invalid input"
        validated="error"
      />
    );
    const helperText = screen.getByText("Invalid input");

    expect(helperText).toBeInTheDocument();
  });

  it("calls onBlur event handler", () => {
    const onBlurMock = jest.fn();
    plainRender(
      <PasswordInput
        id="password"
        name="password"
        label={_("Password")}
        fieldId="password"
        ariaLabel={_("User password")}
        onBlur={onBlurMock}
      />
    );
    const inputField = screen.getByLabelText("Password");

    fireEvent.blur(inputField);
    expect(onBlurMock).toHaveBeenCalled();
  });

  it("ensures accessibility attributes are set correctly", () => {
    plainRender(
      <PasswordInput
        id="password"
        name="password"
        label={_("Password")}
        fieldId="password"
        ariaLabel={_("Password")}
      />
    );
    const inputField = screen.getByLabelText("Password");
    const visibilityButton = screen.getByLabelText("Password visibility button");

    expect(inputField).toHaveAttribute("aria-label", "Password");
    expect(visibilityButton).toHaveAttribute("aria-label", "Password visibility button");
  });

  it("handles setting and changing the input value", async () => {
    let inputValue = "";
    const handleChange = (value) => {
      inputValue = value;
    };

    plainRender(
      <PasswordInput
        id="password"
        name="password"
        label={_("Password")}
        fieldId="password"
        ariaLabel={_("Password")}
        value={inputValue}
        onChange={handleChange}
      />
    );
    const inputField = screen.getByLabelText("Password");
    
    await fireEvent.change(inputField, { target: { value: "newpassword" }});
    expect(inputValue).toBe("newpassword");
  });
});
