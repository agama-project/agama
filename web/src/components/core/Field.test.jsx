/*
 * Copyright (c) [2024] SUSE LLC
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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { Field, ExpandableField, SettingsField, SwitchField } from "~/components/core";

const onClick = jest.fn();

describe("Field", () => {
  it("renders a button with given icon and label", () => {
    const { container } = plainRender(
      <Field icon="edit" label="Theme" value="dark" onClick={onClick} />
    );
    screen.getByRole("button", { name: "Theme" });
    const icon = container.querySelector("button > svg");
    expect(icon).toHaveAttribute("data-icon-name", "edit");
  });

  it("renders value, description, and given children", () => {
    plainRender(
      <Field
        icon="edit"
        label="Theme"
        value="dark"
        description="Choose your preferred color schema."
        onClick={onClick}
      >
        <p>This is a <b>preview</b></p>;
      </Field>
    );
    screen.getByText("dark");
    screen.getByText("Choose your preferred color schema.");
    screen.getByText("This is a");
    screen.getByText("preview");
  });

  it("triggers the onClick callback when users clicks the button", async () => {
    const { user } = plainRender(
      <Field label="Theme" value="dark" onClick={onClick} />
    );
    const button = screen.getByRole("button");
    await user.click(button);
    expect(onClick).toHaveBeenCalled();
  });
});

describe("SettingsField", () => {
  it("uses the 'shadow' icon", () => {
    const { container } = plainRender(
      // Trying to set other icon, although typechecking should catch it.
      <SettingsField icon="edit" label="Theme" value="dark" onClick={onClick} />
    );
    const icon = container.querySelector("button > svg");
    expect(icon).toHaveAttribute("data-icon-name", "shadow");
  });
});

describe("SwitchField", () => {
  it("sets button role to switch", () => {
    plainRender(<SwitchField label="Zoom" value="enabled" isChecked />);
    const switchButton = screen.getByRole("switch", { name: "Zoom" });
    expect(switchButton instanceof HTMLButtonElement).toBe(true);
  });

  it("keeps aria-checked attribute in sync with isChecked prop", () => {
    let switchButton;
    const { rerender } = plainRender(<SwitchField label="Zoom" value="enabled" isChecked />);
    switchButton = screen.getByRole("switch", { name: "Zoom" });
    expect(switchButton).toHaveAttribute("aria-checked", "true");

    rerender(<SwitchField label="Zoom" value="disabled" />);
    switchButton = screen.getByRole("switch", { name: "Zoom" });
    expect(switchButton).toHaveAttribute("aria-checked", "false");
  });

  it("uses the 'toggle_on' icon when isChecked", () => {
    const { container } = plainRender(
      <SwitchField label="Zoom" value="enabled" isChecked />
    );
    const icon = container.querySelector("button > svg");
    expect(icon).toHaveAttribute("data-icon-name", "toggle_on");
  });

  it("uses the 'toggle_off' icon when not isChecked", () => {
    const { container } = plainRender(
      <SwitchField label="Zoom" value="disabled" />
    );
    const icon = container.querySelector("button > svg");
    expect(icon).toHaveAttribute("data-icon-name", "toggle_off");
  });
});

describe("ExpandableField", () => {
  it("uses 'expanded' as className prop value when isExpanded", () => {
    const { container } = plainRender(<ExpandableField label="More settings" isExpanded />);
    const field = container.querySelector("[data-type='agama/field']");
    expect(field.classList.contains("expanded")).toBe(true);
  });

  it("uses 'collapsed' as className prop value when isExpanded", () => {
    const { container } = plainRender(<ExpandableField label="More settings" />);
    const field = container.querySelector("[data-type='agama/field']");
    expect(field.classList.contains("collapsed")).toBe(true);
  });
});
