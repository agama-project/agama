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
import { installerRender } from "~/test-utils";
import { useSystem } from "~/hooks/model/system";
import { useAppForm } from "~/hooks/form";
import { defaultOptions } from "./fields";

import type { Keymap, Locale } from "~/model/system/l10n";

const locales: Locale[] = [
  { id: "en_US.UTF-8", language: "English", territory: "United States" },
];

const keymaps: Keymap[] = [{ id: "us", description: "English (US)" }];

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({
    keymap: "us",
    language: "en-US",
  }),
}));

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: (): ReturnType<typeof useSystem> => ({
    l10n: { locales, keymaps, locale: "en_US.UTF-8", keymap: "us" },
  }),
}));

function PasswordFieldsForm() {
  const form = useAppForm(defaultOptions);

  return (
    <form.AppForm>
      <form.AppField name="password">
        {(field) => <field.MaskedField label="Password" />}
      </form.AppField>

      <form.AppField name="passwordConfirmation">
        {(field) => (
          <field.MaskedField
            label="Password confirmation"
            hideReminders={["keymap", "capslock"]}
          />
        )}
      </form.AppField>
    </form.AppForm>
  );
}

describe("PasswordFields", () => {
  it("renders password field", () => {
    installerRender(<PasswordFieldsForm />);
    screen.getByLabelText("Password");
  });

  it("renders password confirmation field", () => {
    installerRender(<PasswordFieldsForm />);
    screen.getByLabelText("Password confirmation");
  });

  it("both fields are password type by default", () => {
    installerRender(<PasswordFieldsForm />);
    const passwordField = screen.getByLabelText("Password");
    const confirmationField = screen.getByLabelText("Password confirmation");

    expect(passwordField).toHaveAttribute("type", "password");
    expect(confirmationField).toHaveAttribute("type", "password");
  });

  it("shows keymap reminder on password field", () => {
    installerRender(<PasswordFieldsForm />);
    screen.getByText("us");
    screen.getByText(/keyboard layout/i);
  });

  it("does not show keymap reminder on confirmation field", () => {
    installerRender(<PasswordFieldsForm />);
    const reminders = screen.getAllByText("us");
    expect(reminders).toHaveLength(1);
  });

  it("allows typing in password field", async () => {
    const { user } = installerRender(<PasswordFieldsForm />);
    const passwordField = screen.getByLabelText("Password");
    await user.type(passwordField, "secret123");
    expect(passwordField).toHaveValue("secret123");
  });

  it("allows typing in confirmation field", async () => {
    const { user } = installerRender(<PasswordFieldsForm />);
    const confirmationField = screen.getByLabelText("Password confirmation");
    await user.type(confirmationField, "secret123");
    expect(confirmationField).toHaveValue("secret123");
  });

  it("has visibility toggle buttons for both fields", () => {
    installerRender(<PasswordFieldsForm />);
    const toggleButtons = screen.getAllByRole("button", { name: "Password visibility button" });
    expect(toggleButtons).toHaveLength(2);
  });

  it("can toggle password visibility on password field", async () => {
    const { user } = installerRender(<PasswordFieldsForm />);
    const passwordField = screen.getByLabelText("Password");
    const toggleButtons = screen.getAllByRole("button", { name: "Password visibility button" });

    expect(passwordField).toHaveAttribute("type", "password");

    await user.click(toggleButtons[0]);
    expect(passwordField).toHaveAttribute("type", "text");

    await user.click(toggleButtons[0]);
    expect(passwordField).toHaveAttribute("type", "password");
  });

  it("can toggle password visibility on confirmation field", async () => {
    const { user } = installerRender(<PasswordFieldsForm />);
    const confirmationField = screen.getByLabelText("Password confirmation");
    const toggleButtons = screen.getAllByRole("button", { name: "Password visibility button" });

    expect(confirmationField).toHaveAttribute("type", "password");

    await user.click(toggleButtons[1]);
    expect(confirmationField).toHaveAttribute("type", "text");

    await user.click(toggleButtons[1]);
    expect(confirmationField).toHaveAttribute("type", "password");
  });
});
