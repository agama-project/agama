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

import React, { useState } from "react";
import { screen } from "@testing-library/react";
import {
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  MenuToggleElement,
} from "@patternfly/react-core";
import { installerRender } from "~/test-utils";
import { useComboboxKeyboard } from "./use-combobox-keyboard";

// Test component that uses the hook with a PatternFly Select
function TestSelect({ onSelect = jest.fn() }) {
  const { isOpen, setIsOpen, menuRef, getToggleRef, onToggleKeydown } = useComboboxKeyboard();
  const [selected, setSelected] = useState("option1");

  return (
    <Select
      ref={menuRef}
      isOpen={isOpen}
      selected={selected}
      onSelect={(_, value) => {
        if (typeof value === "string") {
          setSelected(value);
          onSelect(value);
        }
        setIsOpen(false);
      }}
      onOpenChange={setIsOpen}
      onToggleKeydown={onToggleKeydown}
      shouldFocusToggleOnSelect
      toggle={(pfToggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={getToggleRef(pfToggleRef)}
          onClick={() => setIsOpen(!isOpen)}
          isExpanded={isOpen}
        >
          {selected}
        </MenuToggle>
      )}
    >
      <SelectList>
        <SelectOption value="option1">Option 1</SelectOption>
        <SelectOption value="option2">Option 2</SelectOption>
        <SelectOption value="option3">Option 3</SelectOption>
      </SelectList>
    </Select>
  );
}

describe("useComboboxKeyboard", () => {
  it("opens menu and focuses first item when ArrowDown is pressed on closed toggle", async () => {
    const { user } = installerRender(<TestSelect />);

    const toggle = screen.getByRole("button", { name: "option1" });
    toggle.focus();

    await user.keyboard("{ArrowDown}");

    // Menu should be open
    screen.getByRole("listbox");

    // First option should be focused
    const firstOption = screen.getByRole("option", { name: "Option 1" });
    expect(firstOption).toHaveFocus();
  });

  it("opens menu and focuses last item when ArrowUp is pressed on closed toggle", async () => {
    const { user } = installerRender(<TestSelect />);

    const toggle = screen.getByRole("button", { name: "option1" });
    toggle.focus();

    await user.keyboard("{ArrowUp}");

    // Menu should be open
    screen.getByRole("listbox");

    // Last option should be focused
    const lastOption = screen.getByRole("option", { name: "Option 3" });
    expect(lastOption).toHaveFocus();
  });

  it("allows navigation with arrow keys within open menu", async () => {
    const { user } = installerRender(<TestSelect />);

    const toggle = screen.getByRole("button", { name: "option1" });
    toggle.focus();

    // Open menu with ArrowDown
    await user.keyboard("{ArrowDown}");

    const firstOption = screen.getByRole("option", { name: "Option 1" });
    expect(firstOption).toHaveFocus();

    // Navigate to second option
    await user.keyboard("{ArrowDown}");
    const secondOption = screen.getByRole("option", { name: "Option 2" });
    expect(secondOption).toHaveFocus();

    // Navigate back to first option
    await user.keyboard("{ArrowUp}");
    expect(firstOption).toHaveFocus();
  });

  it("does not change value when navigating with arrow keys (explore-then-commit)", async () => {
    const onSelect = jest.fn();
    const { user } = installerRender(<TestSelect onSelect={onSelect} />);

    const toggle = screen.getByRole("button", { name: "option1" });
    toggle.focus();

    // Open menu and navigate through all options
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");

    // Navigation should NOT trigger selection
    expect(onSelect).not.toHaveBeenCalled();

    // Cancel to close menu
    await user.keyboard("{Escape}");

    // Original selection should remain
    screen.getByRole("button", { name: "option1" });
  });

  it("restores focus to toggle when menu closes after selection", async () => {
    const { user } = installerRender(<TestSelect />);

    const toggle = screen.getByRole("button", { name: "option1" });
    toggle.focus();

    // Open menu with ArrowDown
    await user.keyboard("{ArrowDown}");

    // Navigate to second option
    await user.keyboard("{ArrowDown}");

    // Select the option with Enter
    await user.keyboard("{Enter}");

    // Focus should be restored to the toggle button
    expect(toggle).toHaveFocus();
  });

  describe("with external state management", () => {
    // Test component that manages its own state and passes it to the hook
    function TestSelectWithExternalState() {
      const [isOpen, setIsOpen] = useState(false);
      const { menuRef, getToggleRef, onToggleKeydown } = useComboboxKeyboard({ isOpen, setIsOpen });
      const [selected, setSelected] = useState("option1");

      return (
        <Select
          ref={menuRef}
          isOpen={isOpen}
          selected={selected}
          onSelect={(_, value) => {
            if (typeof value === "string") setSelected(value);
            setIsOpen(false);
          }}
          onOpenChange={setIsOpen}
          onToggleKeydown={onToggleKeydown}
          shouldFocusToggleOnSelect
          toggle={(pfToggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={getToggleRef(pfToggleRef)}
              onClick={() => setIsOpen(!isOpen)}
              isExpanded={isOpen}
            >
              {selected}
            </MenuToggle>
          )}
        >
          <SelectList>
            <SelectOption value="option1">Option 1</SelectOption>
            <SelectOption value="option2">Option 2</SelectOption>
          </SelectList>
        </Select>
      );
    }

    it("works with external isOpen state", async () => {
      const { user } = installerRender(<TestSelectWithExternalState />);

      const toggle = screen.getByRole("button", { name: "option1" });
      toggle.focus();

      await user.keyboard("{ArrowDown}");

      // Menu should be open
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      screen.getByRole("listbox");

      // First option should be focused
      const firstOption = screen.getByRole("option", { name: "Option 1" });
      expect(firstOption).toHaveFocus();
    });
  });
});
