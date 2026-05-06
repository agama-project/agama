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

const OPTIONS = [
  { value: "default", label: "Default", description: "System manages this" },
  { value: "custom", label: "Custom", description: "Configure manually" },
];

function TestForm({ defaultValue = "default" }: { defaultValue?: string }) {
  const form = useAppForm({ defaultValues: { mode: defaultValue } });

  return (
    <form.AppField name="mode">
      {(field) => (
        <field.DropdownField label="IPv4 Settings" options={OPTIONS}>
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
});
