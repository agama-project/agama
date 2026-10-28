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

import type { Keymap, Locale } from "~/model/system/l10n";

const locales: Locale[] = [
  { id: "en_US.UTF-8", language: "English", territory: "United States" },
  { id: "es_ES.UTF-8", language: "Spanish", territory: "Spain" },
];

const keymaps: Keymap[] = [
  { id: "us", description: "English (US)" },
  { id: "gb", description: "English (UK)" },
];

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({
    keymap: "us",
    language: "de-DE",
  }),
}));

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: (): ReturnType<typeof useSystem> => ({
    l10n: { locales, keymaps, locale: "en_US.UTF-8", keymap: "us" },
  }),
}));

function MaskedFieldForm({
  defaultValue = "",
  helperText,
  hideReminders,
}: {
  defaultValue?: string;
  helperText?: string;
  hideReminders?: ("keymap" | "capslock")[];
}) {
  const form = useAppForm({ defaultValues: { secret: defaultValue } });

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.setErrorMap({ onSubmit: { fields: {} } });
          form.handleSubmit();
        }}
      >
        <form.AppField
          name="secret"
          validators={{ onSubmit: ({ value }) => (!value ? "Secret is required" : undefined) }}
        >
          {(field) => (
            <field.MaskedField
              label="Secret code"
              helperText={helperText}
              hideReminders={hideReminders}
            />
          )}
        </form.AppField>
        <button type="submit">Submit</button>
      </form>
    </form.AppForm>
  );
}

describe("MaskedField", () => {
  it("renders with type password", () => {
    installerRender(<MaskedFieldForm />);
    const input = screen.getByLabelText("Secret code");
    expect(input).toHaveAttribute("type", "password");
  });

  it("updates when the user types", async () => {
    const { user } = installerRender(<MaskedFieldForm />);
    const input = screen.getByLabelText("Secret code");
    await user.type(input, "mysecret");
    expect(input).toHaveValue("mysecret");
  });

  it("toggles visibility when clicking the visibility button", async () => {
    const { user } = installerRender(<MaskedFieldForm defaultValue="secret123" />);
    const input = screen.getByLabelText("Secret code");
    const toggleButton = screen.getByRole("button", { name: "Password visibility button" });

    expect(input).toHaveAttribute("type", "password");

    await user.click(toggleButton);
    expect(input).toHaveAttribute("type", "text");

    await user.click(toggleButton);
    expect(input).toHaveAttribute("type", "password");
  });

  it("shows a validation error after a failed submit", async () => {
    const { user } = installerRender(<MaskedFieldForm />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Secret is required");
  });

  describe("reminders", () => {
    it("shows all reminders by default", async () => {
      const { user } = installerRender(<MaskedFieldForm />);
      const input = screen.getByLabelText("Secret code");
      screen.getByText("us");
      screen.getByText(/keyboard layout/i);
      expect(screen.queryByText(/CAPS LOCK/)).not.toBeInTheDocument();
      await user.type(input, "{capslock}");
      screen.getByText(/CAPS LOCK/);
    });

    it("hides the keymap reminder when set", () => {
      installerRender(<MaskedFieldForm hideReminders={["keymap"]} />);
      expect(screen.queryByText(/keyboard layout/i)).not.toBeInTheDocument();
    });

    it("hides the capslock reminder when set", () => {
      installerRender(<MaskedFieldForm hideReminders={["capslock"]} />);
      expect(screen.queryByText(/caps lock/i)).not.toBeInTheDocument();
    });

    it("hides all reminders when all are set", () => {
      installerRender(<MaskedFieldForm hideReminders={["keymap", "capslock"]} />);
      expect(screen.queryByText(/keyboard layout/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/caps lock/i)).not.toBeInTheDocument();
    });
  });

  describe("helperText", () => {
    it("shows helper text when provided", () => {
      installerRender(<MaskedFieldForm helperText="Keep this safe" />);
      screen.getByText("Keep this safe");
    });

    it("does not show helper text when not provided", () => {
      installerRender(<MaskedFieldForm />);
      expect(screen.queryByText("Keep this")).not.toBeInTheDocument();
    });

    it("shows both helper text and error when there is an error", async () => {
      const { user } = installerRender(<MaskedFieldForm helperText="Keep this safe" />);
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByText("Secret is required");
      screen.getByText("Keep this safe");
    });
  });
});
