/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { installerRender } from "~/test-utils";
import userEvent from "@testing-library/user-event";
import PasswordInput, { PasswordInputProps } from "./PasswordInput";
import * as utils from "~/utils";

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({
    keymap: "us",
    language: "de-DE",
  }),
}));

describe("PasswordInput", () => {
  it("renders a password input", () => {
    installerRender(<PasswordInput id="password" name="password" aria-label="User password" />, {
      withL10n: true,
    });

    const inputField = screen.getByLabelText("User password");
    expect(inputField).toHaveAttribute("type", "password");
  });

  it("allows revealing the password", async () => {
    installerRender(<PasswordInput id="password" name="password" aria-label="User password" />, {
      withL10n: true,
    });

    const passwordInput = screen.getByLabelText("User password");
    const button = screen.getByRole("button");

    expect(passwordInput).toHaveAttribute("type", "password");
    await userEvent.click(button);
    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("applies autoFocus behavior correctly", () => {
    installerRender(
      <PasswordInput autoFocus id="password" name="password" aria-label="User password" />,
      { withL10n: true },
    );

    const inputField = screen.getByLabelText("User password");
    expect(document.activeElement).toBe(inputField);
  });

  // Using a controlled component for testing the rendered result instead of testing if
  // the given onChange callback is called. The former is more aligned with the
  // React Testing Library principles, https://testing-library.com/docs/guiding-principles/
  const PasswordInputTest = (props: PasswordInputProps) => {
    const [password, setPassword] = useState(null);

    return (
      <>
        <PasswordInput {...props} onChange={(_, v) => setPassword(v)} />
        {password && <p>Password value updated!</p>}
      </>
    );
  };

  it("triggers onChange callback", async () => {
    const { user } = installerRender(
      <PasswordInputTest id="test-password" aria-label="Test password" />,
      { withL10n: true },
    );
    const passwordInput = screen.getByLabelText("Test password");

    expect(screen.queryByText("Password value updated!")).toBeNull();
    await user.type(passwordInput, "secret");

    screen.getByText("Password value updated!");
  });

  it("renders keyboard reminders by default", async () => {
    const { user } = installerRender(
      <PasswordInput id="password" name="password" aria-label="User password" />,
      {
        withL10n: true,
      },
    );

    screen.getByLabelText("User password");
    screen.getByText(/^Using/);
    screen.getByText("us");
    screen.getByText(/keyboard$/);
    await user.keyboard("{CapsLock}");
    screen.getByText(/^CAPS LOCK/);
    screen.getByText(/is on$/);
    await user.keyboard("{CapsLock}");
    expect(screen.queryByText(/^CAPS LOCK/)).toBeNull();
  });

  it("allow disabling reminders via reminders prop", async () => {
    const { user } = installerRender(
      <PasswordInput id="password" name="password" aria-label="User password" reminders={[]} />,
      {
        withL10n: true,
      },
    );

    expect(screen.queryByText(/^Using/)).toBeNull();
    expect(screen.queryByText(/^CAPS LOCK/)).toBeNull();
    await user.keyboard("{CapsLock}");
    expect(screen.queryByText(/^CAPS LOCK/)).toBeNull();
  });

  it("allows picking only the keymap reminder", async () => {
    const { user } = installerRender(
      <PasswordInput
        id="password"
        name="password"
        aria-label="User password"
        reminders={["keymap"]}
      />,
      {
        withL10n: true,
      },
    );

    screen.getByText(/^Using/);
    await user.keyboard("{CapsLock}");
    expect(screen.queryByText(/^CAPS LOCK/)).toBeNull();
    expect(screen.queryByText(/is on$/)).toBeNull();
  });

  it("allows picking only the caps locsk reminder", async () => {
    const { user } = installerRender(
      <PasswordInput
        id="password"
        name="password"
        aria-label="User password"
        reminders={["capslock"]}
      />,
      {
        withL10n: true,
      },
    );

    expect(screen.queryByText(/^Using/)).toBeNull();
    await user.keyboard("{CapsLock}");
    screen.getByText(/^CAPS LOCK/);
    screen.getByText(/is on$/);
    await user.keyboard("{CapsLock}");
    expect(screen.queryByText(/^CAPS LOCK/)).toBeNull();
  });

  it("does not render the keymap reminder in remote connections", () => {
    jest.spyOn(utils, "localConnection").mockReturnValue(false);

    installerRender(<PasswordInput id="password" name="password" aria-label="User password" />, {
      withL10n: true,
    });

    expect(screen.queryByText(/^Using/)).toBeNull();
  });
});
