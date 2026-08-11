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
import { useAppForm } from "~/hooks/form";

import type { TranslatedString } from "~/i18n";

const OPTIONS = [
  { value: "default", label: "Default", description: "System manages this" },
  { value: "custom", label: "Custom", description: "Configure manually" },
];

let onFooterEntrySelect: () => void;

function TestForm({
  defaultValue = "default",
  withFooterEntry = false,
  options = OPTIONS,
  opensDialog = true,
  hint,
}: {
  defaultValue?: string;
  withFooterEntry?: boolean;
  options?: typeof OPTIONS;
  opensDialog?: boolean;
  hint?: TranslatedString;
}) {
  const form = useAppForm({ defaultValues: { mode: defaultValue } });
  const footerEntry = {
    label: "Browse all modes",
    onSelect: onFooterEntrySelect,
    opensDialog,
    hint,
  };

  return (
    <form.AppField name="mode">
      {(field) => (
        <field.DropdownField
          label="IPv4 Settings"
          options={options}
          footerEntry={withFooterEntry ? footerEntry : undefined}
        >
          {(value) => value === "custom" && <div>Custom content</div>}
        </field.DropdownField>
      )}
    </form.AppField>
  );
}

// NOTE: Keyboard navigation tests (arrow keys open menu, explore-then-commit) are
// not duplicated here because:
//   - The behavior is comprehensively tested in use-select-keyboard.test.tsx
//   - These tests focus on TanStack Form integration and rendering behavior
describe("DropdownField", () => {
  beforeEach(() => {
    onFooterEntrySelect = jest.fn();
  });

  it("renders the label", () => {
    installerRender(<TestForm />);
    screen.getByText("IPv4 Settings");
  });

  it("shows the selected option label", () => {
    installerRender(<TestForm defaultValue="custom" />);
    screen.getByText("Custom");
  });

  it("renders dependent content when the matching option is selected", () => {
    installerRender(<TestForm defaultValue="custom" />);
    screen.getByText("Custom content");
  });

  it("does not render dependent content when the option is not selected", () => {
    installerRender(<TestForm defaultValue="default" />);
    expect(screen.queryByText("Custom content")).not.toBeInTheDocument();
  });

  it("renders dependent content when the user selects an option", async () => {
    const { user } = installerRender(<TestForm defaultValue="default" />);
    await user.click(screen.getByText("Default"));
    await user.click(screen.getByText("Custom"));
    screen.getByText("Custom content");
  });

  describe("when no footer entry is given", () => {
    it("renders no additional entry", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByText("Default"));
      expect(screen.getAllByRole("option")).toHaveLength(OPTIONS.length);
    });
  });

  describe("when a footer entry is given", () => {
    it("renders last, telling screen reader users that a dialog is coming", async () => {
      const { user } = installerRender(<TestForm withFooterEntry />);
      await user.click(screen.getByText("Default"));
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(OPTIONS.length + 1);
      expect(options.at(-1)).toHaveAccessibleName("Browse all modes Opens a dialog");
    });

    it("stays silent about a dialog when the entry opens none", async () => {
      const { user } = installerRender(<TestForm withFooterEntry opensDialog={false} />);
      await user.click(screen.getByText("Default"));
      expect(screen.getByRole("option", { name: /^Browse all modes/ })).toHaveAccessibleName(
        "Browse all modes",
      );
    });

    it("speaks a given hint instead of the standard one", async () => {
      const { user } = installerRender(
        <TestForm withFooterEntry hint={"Opens the devices page" as TranslatedString} />,
      );
      await user.click(screen.getByText("Default"));
      expect(screen.getByRole("option", { name: /^Browse all modes/ })).toHaveAccessibleName(
        "Browse all modes Opens the devices page",
      );
    });

    it("carries no attribute an option is not allowed to have", async () => {
      const { user } = installerRender(<TestForm withFooterEntry />);
      await user.click(screen.getByText("Default"));
      expect(screen.getByRole("option", { name: /^Browse all modes/ })).not.toHaveAttribute(
        "aria-haspopup",
      );
    });

    it("does not submit the form it lives in", async () => {
      const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
      const { user } = installerRender(
        <form onSubmit={onSubmit}>
          <TestForm withFooterEntry />
        </form>,
      );
      await user.click(screen.getByText("Default"));
      const entry = screen.getByRole("option", { name: /^Browse all modes/ });
      expect(entry).toHaveAttribute("type", "button");
      await user.click(entry);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("renders no divider when there are no options to separate it from", async () => {
      const { user } = installerRender(<TestForm withFooterEntry options={[]} />);
      await user.click(screen.getByLabelText("IPv4 Settings"));
      expect(screen.getAllByRole("option")).toHaveLength(1);
      expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    });

    it("runs its callback without changing the field value", async () => {
      const { user } = installerRender(<TestForm withFooterEntry defaultValue="custom" />);
      await user.click(screen.getByText("Custom"));
      await user.click(screen.getByRole("option", { name: /^Browse all modes/ }));
      expect(onFooterEntrySelect).toHaveBeenCalled();
      expect(screen.getByLabelText("IPv4 Settings")).toHaveTextContent("Custom");
    });
  });
});
