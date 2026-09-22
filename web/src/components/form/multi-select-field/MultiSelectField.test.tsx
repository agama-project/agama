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
import { screen, waitFor, within } from "@testing-library/react";
import { getAnnouncements, installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { _ } from "~/i18n";

import type { MultiSelectOption } from "~/components/form/multi-select-field/rows";

const OPTIONS: MultiSelectOption[] = [
  { value: "eth0", label: "Ethernet 0" },
  { value: "eth1", label: "Ethernet 1" },
  { value: "wlan0", label: "Wireless 0" },
];

type TestFormProps = {
  defaultValues?: string[];
  options?: MultiSelectOption[];
  allowCustomEntries?: boolean;
  tabKeepsFocus?: boolean;
  autoHighlight?: boolean;
  showNoResults?: boolean;
  entriesThreshold?: number;
  overflowBehavior?: "expandOnFocus" | "toggle";
  collapseInputOnBlur?: boolean;
  hideClearAllOnBlur?: boolean;
  footerEntry?: { label: string; onSelect: () => void };
  validateOnChange?: (value: string) => string | undefined;
  validateOnSubmit?: (value: string) => string | undefined;
  /** Simulates a TanStack Form field-level error returned by onSubmitAsync. */
  fieldError?: string;
  normalize?: (value: string) => string;
  displayValue?: (value: string) => string;
  helperText?: string;
  onChange?: (values: string[]) => void;
};

function TestForm({
  defaultValues = [],
  options = OPTIONS,
  allowCustomEntries,
  tabKeepsFocus,
  autoHighlight,
  showNoResults,
  entriesThreshold,
  overflowBehavior,
  collapseInputOnBlur,
  hideClearAllOnBlur,
  footerEntry,
  validateOnChange,
  validateOnSubmit,
  fieldError,
  normalize,
  displayValue,
  helperText,
  onChange,
}: TestFormProps) {
  const form = useAppForm({
    defaultValues: { ports: defaultValues },
    validators: {
      onSubmitAsync: fieldError ? async () => ({ fields: { ports: fieldError } }) : undefined,
    },
  });

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.AppField
          name="ports"
          listeners={{ onChange: ({ value }) => onChange?.(value as string[]) }}
        >
          {(field) => (
            <field.MultiSelectField
              label={_("Bond ports")}
              options={options}
              allowCustomEntries={allowCustomEntries}
              tabKeepsFocus={tabKeepsFocus}
              autoHighlight={autoHighlight}
              showNoResults={showNoResults}
              entriesThreshold={entriesThreshold}
              overflowBehavior={overflowBehavior}
              collapseInputOnBlur={collapseInputOnBlur}
              hideClearAllOnBlur={hideClearAllOnBlur}
              footerEntry={footerEntry}
              validateOnChange={validateOnChange}
              validateOnSubmit={validateOnSubmit}
              normalize={normalize}
              displayValue={displayValue}
              helperText={helperText}
            />
          )}
        </form.AppField>
        <button type="submit">Submit</button>
        <button type="button">Other</button>
      </form>
    </form.AppForm>
  );
}

/** The text box, which is the field's single tab stop. */
const combobox = () => screen.getByRole("combobox", { name: "Bond ports" });

/** The floating list of options, when it is on screen. */
const optionList = () => screen.getByRole("listbox", { name: "Bond ports" });

/** The committed values. */
const entries = () => screen.getByRole("listbox", { name: "Bond ports entries" });

/** Everything the live regions are saying right now, as one text. */
const announcement = () => getAnnouncements().join(" ");

/** What the keyboard is on, which the text box points at. */
const activeElement = (): HTMLElement | null => {
  const id = combobox().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

describe("MultiSelectField", () => {
  describe("structure", () => {
    it("renders the label", () => {
      installerRender(<TestForm />);
      screen.getByText("Bond ports");
    });

    it("names the text box and the list of values from the label", () => {
      installerRender(<TestForm defaultValues={["eth0"]} />);
      combobox();
      entries();
    });

    it("points the text box at instructions for screen readers", () => {
      installerRender(<TestForm />);
      const instructions = screen.getByText("Down arrow opens the list of options.");
      const instructionsId = instructions.closest("[id]")?.id;
      expect(combobox().getAttribute("aria-describedby")).toContain(instructionsId);
    });

    it("does not show the list until it is asked for", () => {
      installerRender(<TestForm />);
      expect(combobox()).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("listbox", { name: "Bond ports" })).toBeNull();
    });

    it("offers every value as a multi selectable option", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByRole("button", { name: "Show options" }));

      expect(combobox()).toHaveAttribute("aria-expanded", "true");
      expect(combobox().getAttribute("aria-controls")).toEqual(optionList().id);
      expect(optionList()).toHaveAttribute("aria-multiselectable", "true");
      expect(within(optionList()).getAllByRole("option")).toHaveLength(3);
    });

    it("marks the committed values in the list", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth1"]} />);
      await user.click(screen.getByRole("button", { name: "Show options" }));

      const rows = within(optionList()).getAllByRole("option");
      expect(rows[0]).toHaveAttribute("aria-selected", "false");
      expect(rows[1]).toHaveAttribute("aria-selected", "true");
    });

    it("shows the committed values with their option label", () => {
      installerRender(<TestForm defaultValues={["eth0", "wlan0"]} />);
      within(entries()).getByRole("option", { name: "Ethernet 0" });
      within(entries()).getByRole("option", { name: "Wireless 0" });
    });

    it("renders the button that empties the field only when there is something to empty", async () => {
      const { user } = installerRender(<TestForm />);
      expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();

      await user.type(combobox(), "e");
      expect(screen.getByRole("button", { name: "Clear all" })).toHaveAttribute("tabindex", "-1");
    });

    it("shows the given helper text", () => {
      installerRender(<TestForm helperText="Choose devices." />);
      screen.getByText("Choose devices.");
    });
  });

  describe("typing", () => {
    it("opens the list, narrows it down and picks out the best match", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "Ethernet");

      expect(within(optionList()).getAllByRole("option")).toHaveLength(2);
      expect(activeElement()).toHaveAccessibleName("Ethernet 0");
    });

    it("picks nothing out when the field is not to choose for the user", async () => {
      const { user } = installerRender(<TestForm autoHighlight={false} />);
      await user.type(combobox(), "Ethernet");

      expect(within(optionList()).getAllByRole("option")).toHaveLength(2);
      expect(combobox()).not.toHaveAttribute("aria-activedescendant");
    });

    it("picks nothing out while the user deletes what they wrote", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "Ethernet{Backspace}");

      expect(combobox()).not.toHaveAttribute("aria-activedescendant");
    });

    it("picks out the text as typed when the field takes values of its own", async () => {
      const { user } = installerRender(<TestForm allowCustomEntries />);
      await user.type(combobox(), "Ethernet");

      expect(activeElement()).toHaveAccessibleName('Use "Ethernet"');
    });

    it("says how many options are left once the typing stops", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "Ethernet");

      await waitFor(() => expect(announcement()).toContain("2 options available."));
    });

    it("says when nothing matches", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "zzz");

      await waitFor(() => expect(announcement()).toContain("No options match."));
    });

    it("commits the option the text names exactly", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "eth0{Enter}");

      within(entries()).getByRole("option", { name: "Ethernet 0" });
      expect(combobox()).toHaveValue("");
    });

    it("refuses text naming nothing on offer", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "nothing{Enter}");

      expect(screen.queryByRole("listbox", { name: "Bond ports entries" })).toBeNull();
      expect(announcement()).toContain("nothing is not available.");
    });

    it("commits what the text names when focus leaves", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "Ethernet 1");
      await user.click(screen.getByRole("button", { name: "Other" }));

      within(entries()).getByRole("option", { name: "Ethernet 1" });
    });
  });

  describe("walking the list", () => {
    it("picks out the first option on Down and the last on Up", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(combobox());

      await user.keyboard("{ArrowDown}");
      expect(activeElement()).toHaveTextContent("Ethernet 0");

      await user.keyboard("{Escape}{ArrowUp}");
      expect(activeElement()).toHaveTextContent("Wireless 0");
    });

    it("comes back around at both ends", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(combobox());
      await user.keyboard("{ArrowDown}{ArrowUp}");

      expect(activeElement()).toHaveTextContent("Wireless 0");
    });

    it("jumps to the ends with Home and End", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(combobox());
      await user.keyboard("{ArrowDown}{End}");
      expect(activeElement()).toHaveTextContent("Wireless 0");

      await user.keyboard("{Home}");
      expect(activeElement()).toHaveTextContent("Ethernet 0");
    });

    it("adds the option on Enter and keeps the list open", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(combobox());
      await user.keyboard("{ArrowDown}{Enter}");

      within(entries()).getByRole("option", { name: "Ethernet 0" });
      expect(announcement()).toContain("Ethernet 0 added.");
      expect(within(optionList()).getAllByRole("option")).toHaveLength(3);
    });

    it("takes the option back out on a second Enter", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.click(combobox());
      await user.keyboard("{ArrowDown}{Enter}");

      expect(screen.queryByRole("listbox", { name: "Bond ports entries" })).toBeNull();
      expect(announcement()).toContain("Ethernet 0 removed.");
    });

    it("adds the option that is pressed", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByRole("button", { name: "Show options" }));
      await user.click(within(optionList()).getByRole("option", { name: "Wireless 0" }));

      within(entries()).getByRole("option", { name: "Wireless 0" });
    });

    it("clears the filter after adding, so the whole list is offered again", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "Ethernet");
      await user.keyboard("{ArrowDown}{Enter}");

      expect(combobox()).toHaveValue("");
      expect(within(optionList()).getAllByRole("option")).toHaveLength(3);
    });

    it("closes the list on Escape, keeping the text, and clears it on a second one", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "Ethernet");

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("listbox", { name: "Bond ports" })).toBeNull());
      expect(combobox()).toHaveValue("Ethernet");

      await user.keyboard("{Escape}");
      expect(combobox()).toHaveValue("");
    });
  });

  describe("Tab", () => {
    it("commits the picked out option and keeps focus in the field", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(combobox());
      await user.keyboard("{ArrowDown}");
      await user.tab();

      within(entries()).getByRole("option", { name: "Ethernet 0" });
      expect(combobox()).toHaveFocus();
    });

    it("keeps a value the field already holds, instead of taking it back out", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.type(combobox(), "Ethernet 0");
      await user.tab();

      within(entries()).getByRole("option", { name: "Ethernet 0" });
      expect(announcement()).toContain("Ethernet 0 is already selected.");
    });

    it("commits the text and moves on when the field does not hold focus", async () => {
      const { user } = installerRender(<TestForm tabKeepsFocus={false} />);
      await user.type(combobox(), "eth1");
      await user.tab();

      within(entries()).getByRole("option", { name: "Ethernet 1" });
      expect(combobox()).not.toHaveFocus();
    });

    it("moves on when there is nothing to commit", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(combobox());
      await user.tab();

      expect(combobox()).not.toHaveFocus();
    });
  });

  describe("walking the committed values", () => {
    it("steps into the values on Left with an empty text box", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0", "eth1"]} />);
      await user.click(combobox());
      await user.keyboard("{ArrowLeft}");

      expect(activeElement()).toHaveAccessibleName("Ethernet 1");
    });

    it("steps into the values on Backspace with an empty text box", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.click(combobox());
      await user.keyboard("{Backspace}");

      expect(activeElement()).toHaveAccessibleName("Ethernet 0");
    });

    it("leaves the values alone while the text box holds something", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} autoHighlight={false} />);
      await user.type(combobox(), "wire{ArrowLeft}");

      expect(combobox()).not.toHaveAttribute("aria-activedescendant");
    });

    it("moves between values and back to the text box past the last one", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0", "eth1"]} />);
      await user.click(combobox());
      await user.keyboard("{ArrowLeft}{ArrowLeft}");
      expect(activeElement()).toHaveAccessibleName("Ethernet 0");

      await user.keyboard("{Home}");
      expect(activeElement()).toHaveAccessibleName("Ethernet 0");

      await user.keyboard("{End}");
      expect(activeElement()).toHaveAccessibleName("Ethernet 1");

      await user.keyboard("{ArrowRight}");
      expect(combobox()).not.toHaveAttribute("aria-activedescendant");
    });

    it("removes the value on Delete and stays among the ones that are left", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0", "eth1"]} />);
      await user.click(combobox());
      await user.keyboard("{ArrowLeft}{Delete}");

      expect(within(entries()).queryByRole("option", { name: "Ethernet 1" })).toBeNull();
      expect(activeElement()).toHaveAccessibleName("Ethernet 0");
      expect(announcement()).toContain("Ethernet 1 removed.");
    });

    it("goes back to typing once the last value is gone", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.click(combobox());
      await user.keyboard("{ArrowLeft}{Backspace}");

      expect(combobox()).not.toHaveAttribute("aria-activedescendant");
    });

    it("shows a value it offers in the list on Enter", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.click(combobox());
      await user.keyboard("{ArrowLeft}{Enter}");

      expect(activeElement()).toHaveTextContent("Ethernet 0");
      expect(announcement()).toContain("Ethernet 0 shown in the list of options.");
      // The hint for the part just reached is added to the news, not said over it.
      expect(announcement()).toContain("Enter selects or deselects an option");
    });

    it("takes a value the user wrote back into the text box on Enter", async () => {
      const { user } = installerRender(<TestForm defaultValues={["custom0"]} allowCustomEntries />);
      await user.click(combobox());
      await user.keyboard("{ArrowLeft}{Enter}");

      expect(combobox()).toHaveValue("custom0");
      expect(screen.queryByRole("listbox", { name: "Bond ports entries" })).toBeNull();
      expect(announcement()).toContain("custom0 moved to the text box for editing.");
    });

    it("edits the text rather than the values that are left", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={["custom0", "custom1"]} allowCustomEntries />,
      );
      await user.click(combobox());
      await user.keyboard("{ArrowLeft}{Enter}");

      expect(combobox()).toHaveValue("custom1");
      expect(combobox()).not.toHaveAttribute("aria-activedescendant");

      await user.keyboard("{Backspace}");

      expect(combobox()).toHaveValue("custom");
      expect(within(entries()).getByRole("option", { name: "custom0" })).toBeInTheDocument();
    });

    it("goes back to typing on a key the values do not use", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.click(combobox());
      await user.keyboard("{ArrowLeft}");
      await user.keyboard("a");

      expect(combobox()).toHaveValue("a");
    });

    it("removes a value with its own button, leaving focus where it is", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0", "eth1"]} />);
      await user.click(combobox());
      await user.click(screen.getByRole("button", { name: "Remove Ethernet 0" }));

      expect(within(entries()).queryByRole("option", { name: "Ethernet 0" })).toBeNull();
      expect(combobox()).toHaveFocus();
    });
  });

  describe("emptying the field", () => {
    it("reaches the button with Right and empties everything with Enter", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.click(combobox());
      await user.keyboard("{ArrowRight}");
      expect(activeElement()).toHaveAccessibleName("Clear all");

      await user.keyboard("{Enter}");
      expect(screen.queryByRole("listbox", { name: "Bond ports entries" })).toBeNull();
      expect(announcement()).toContain("All values removed.");
    });

    it("goes back to the text box on Left", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.click(combobox());
      await user.keyboard("{ArrowRight}{ArrowLeft}");

      expect(combobox()).not.toHaveAttribute("aria-activedescendant");
      within(entries()).getByRole("option", { name: "Ethernet 0" });
    });
  });

  describe("the field at rest", () => {
    /**
     * Whether the text box is shrunk away. Nothing but the class says so: the
     * box stays in the page and in the tab order, which is the point of it.
     */
    const isInputPutAway = () => combobox().closest(".agm-field-collapsed-input") !== null;

    it("puts the text box away when focus leaves, and brings it back with focus", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} collapseInputOnBlur />);
      expect(isInputPutAway()).toBe(true);

      await user.click(combobox());
      expect(isInputPutAway()).toBe(false);

      await user.click(screen.getByRole("button", { name: "Other" }));
      expect(isInputPutAway()).toBe(true);
    });

    it("keeps the text box when the field holds no value", () => {
      installerRender(<TestForm collapseInputOnBlur />);
      expect(isInputPutAway()).toBe(false);
    });

    it("keeps the text box when it still holds what was written", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} collapseInputOnBlur />);
      await user.type(combobox(), "nope");
      await user.click(screen.getByRole("button", { name: "Other" }));

      expect(combobox()).toHaveValue("nope");
      expect(isInputPutAway()).toBe(false);
    });

    it("renders the button emptying the field only while the field has focus", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} hideClearAllOnBlur />);
      expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();

      await user.click(combobox());
      screen.getByRole("button", { name: "Clear all" });

      await user.click(screen.getByRole("button", { name: "Other" }));
      expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    });
  });

  describe("values the user writes out", () => {
    it("offers to take the text as it is", async () => {
      const { user } = installerRender(<TestForm allowCustomEntries />);
      await user.type(combobox(), "eth9");

      within(optionList()).getByRole("option", { name: 'Use "eth9"' });
    });

    it("does not offer it for text naming an option", async () => {
      const { user } = installerRender(<TestForm allowCustomEntries />);
      await user.type(combobox(), "Ethernet 0");

      expect(within(optionList()).queryByRole("option", { name: /Use/ })).toBeNull();
    });

    it("does not offer it when the field only takes what it knows", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "eth9");

      await waitFor(() => expect(screen.queryByRole("listbox", { name: "Bond ports" })).toBeNull());
    });

    it("commits the text on Enter", async () => {
      const { user } = installerRender(<TestForm allowCustomEntries />);
      await user.type(combobox(), "eth9{Enter}");

      within(entries()).getByRole("option", { name: "eth9" });
    });

    it("commits the text when its row is pressed", async () => {
      const { user } = installerRender(<TestForm allowCustomEntries />);
      await user.type(combobox(), "eth9");
      await user.click(within(optionList()).getByRole("option", { name: 'Use "eth9"' }));

      within(entries()).getByRole("option", { name: "eth9" });
    });

    it("tidies up the text before committing it", async () => {
      const { user } = installerRender(
        <TestForm allowCustomEntries normalize={(value) => value.toUpperCase()} />,
      );
      await user.type(combobox(), "eth9{Enter}");

      within(entries()).getByRole("option", { name: "ETH9" });
    });

    it("shows it the way the caller asks", () => {
      installerRender(
        <TestForm
          defaultValues={["eth9"]}
          allowCustomEntries
          displayValue={(value) => `${value} (manual)`}
        />,
      );

      within(entries()).getByRole("option", { name: "eth9 (manual)" });
    });
  });

  describe("values already held", () => {
    it("adds nothing and says so", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.type(combobox(), "eth0{Enter}");

      expect(within(entries()).getAllByRole("option")).toHaveLength(1);
      expect(announcement()).toContain("Ethernet 0 is already selected.");
    });
  });

  describe("when the list has nothing to show", () => {
    it("hides instead", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(combobox(), "zzz");

      expect(screen.queryByRole("listbox", { name: "Bond ports" })).toBeNull();
    });

    it("stays with a row saying so when the field asks for it", async () => {
      const { user } = installerRender(<TestForm showNoResults />);
      await user.type(combobox(), "zzz");

      within(optionList()).getByRole("option", { name: "No options match" });
    });

    it("stays for the entry leading somewhere else", async () => {
      const { user } = installerRender(
        <TestForm footerEntry={{ label: "Browse devices", onSelect: jest.fn() }} />,
      );
      await user.type(combobox(), "zzz");

      within(optionList()).getByRole("option", { name: "Browse devices" });
    });
  });

  describe("the entry leading somewhere else", () => {
    it("runs it and commits nothing", async () => {
      const onSelect = jest.fn();
      const { user } = installerRender(
        <TestForm footerEntry={{ label: "Browse devices", onSelect }} />,
      );
      await user.click(combobox());
      await user.keyboard("{ArrowUp}{Enter}");

      expect(onSelect).toHaveBeenCalled();
      expect(screen.queryByRole("listbox", { name: "Bond ports entries" })).toBeNull();
    });
  });

  describe("more values than the field shows", () => {
    const threeValues = ["eth0", "eth1", "wlan0"];

    it("stands for the rest with a summary", () => {
      installerRender(<TestForm defaultValues={threeValues} entriesThreshold={2} />);

      expect(within(entries()).getAllByRole("option")).toHaveLength(2);
      screen.getByText("1 more");
    });

    it("never summarizes a value the user wrote out", () => {
      installerRender(
        <TestForm
          defaultValues={["eth0", "eth1", "custom0"]}
          allowCustomEntries
          entriesThreshold={2}
        />,
      );

      within(entries()).getByRole("option", { name: "custom0" });
      expect(within(entries()).queryByRole("option", { name: "Ethernet 1" })).toBeNull();
    });

    it("shows everything while the field has focus", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={threeValues} entriesThreshold={2} />,
      );
      await user.click(combobox());
      expect(within(entries()).getAllByRole("option")).toHaveLength(3);

      await user.click(screen.getByRole("button", { name: "Other" }));
      expect(within(entries()).getAllByRole("option")).toHaveLength(2);
    });

    it("is one more stop for the keyboard when the summary can be flipped", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={threeValues} entriesThreshold={2} overflowBehavior="toggle" />,
      );
      await user.click(combobox());
      await user.keyboard("{ArrowLeft}");
      expect(activeElement()).toHaveAccessibleName("1 more");

      await user.keyboard("{Enter}");
      expect(within(entries()).getAllByRole("option")).toHaveLength(3);
      expect(announcement()).toContain("Showing all 3 values.");

      await user.keyboard("{Enter}");
      expect(within(entries()).getAllByRole("option")).toHaveLength(2);
      expect(announcement()).toContain("Showing 2 of 3 values.");
    });
  });

  describe("pasting", () => {
    it("takes in every value at once", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(combobox());
      await user.paste("eth0, eth1");

      expect(within(entries()).getAllByRole("option")).toHaveLength(2);
      expect(announcement()).toContain("2 entries added.");
    });

    it("leaves out what the field already holds and what it does not offer", async () => {
      const { user } = installerRender(<TestForm defaultValues={["eth0"]} />);
      await user.click(combobox());
      await user.paste("eth0 eth1 nothing");

      expect(within(entries()).getAllByRole("option")).toHaveLength(2);
      expect(announcement()).toContain("1 entries added, 1 not available, 1 duplicates skipped.");
    });

    it("takes a value in once when the paste itself repeats it", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(combobox());
      await user.paste("eth0 eth0 eth1");

      expect(within(entries()).getAllByRole("option")).toHaveLength(2);
      expect(announcement()).toContain("2 entries added, 1 duplicates skipped.");
    });

    it("leaves a single value in the text box", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(combobox());
      await user.paste("eth0");

      expect(combobox()).toHaveValue("eth0");
      expect(screen.queryByRole("listbox", { name: "Bond ports entries" })).toBeNull();
    });
  });

  describe("per value validation", () => {
    const validateOnChange = (value: string) =>
      value.startsWith("x") ? "Must not start with x" : undefined;

    it("carries the error in the name of the value and under the field", () => {
      installerRender(
        <TestForm
          defaultValues={["xbad"]}
          allowCustomEntries
          validateOnChange={validateOnChange}
        />,
      );

      within(entries()).getByRole("option", { name: "xbad is invalid: Must not start with x" });
      screen.getByText("Must not start with x");
    });

    it("stays quiet until the form is submitted when the caller asks for it", async () => {
      const { user } = installerRender(
        <TestForm
          defaultValues={["xbad"]}
          allowCustomEntries
          validateOnSubmit={validateOnChange}
          fieldError="Some values are not valid"
        />,
      );
      expect(within(entries()).queryByRole("option", { name: /invalid/ })).toBeNull();

      await user.click(screen.getByRole("button", { name: "Submit" }));
      await within(entries()).findByRole("option", { name: /invalid/ });
    });

    // The rule refusing the form and the mark on the value that broke it are
    // often worded the same, and the field is what puts the two together.
    it("says a message the field and a value share only once", async () => {
      const { user } = installerRender(
        <TestForm
          defaultValues={["xbad"]}
          allowCustomEntries
          validateOnSubmit={validateOnChange}
          fieldError="Must not start with x"
        />,
      );
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await within(entries()).findByRole("option", { name: /invalid/ });

      expect(screen.getAllByText("Must not start with x")).toHaveLength(1);
    });

    it("takes out every marked value at once when asked", async () => {
      const onChange = jest.fn();
      const { user } = installerRender(
        <TestForm
          defaultValues={["eth0", "xbad", "xworse"]}
          allowCustomEntries
          validateOnChange={validateOnChange}
          onChange={onChange}
        />,
      );
      await user.click(screen.getByRole("button", { name: /remove all invalid entries/i }));

      expect(onChange).toHaveBeenLastCalledWith(["eth0"]);
    });

    it("offers to take them out only while some value is marked", () => {
      installerRender(
        <TestForm
          defaultValues={["eth0"]}
          allowCustomEntries
          validateOnChange={validateOnChange}
        />,
      );

      expect(screen.queryByText(/remove all invalid entries/i)).toBeNull();
    });

    // A rule refusing the whole field says nothing about which value to take
    // out, so there is nothing to offer until the values are marked themselves.
    it("says nothing about invalid values when only the field is in error", async () => {
      const { user } = installerRender(
        <TestForm
          defaultValues={["eth0"]}
          allowCustomEntries
          fieldError="At least two values are required"
        />,
      );
      await user.click(screen.getByRole("button", { name: "Submit" }));

      await screen.findByText("At least two values are required");
      expect(screen.queryByText(/remove all invalid entries/i)).toBeNull();
    });
  });

  describe("the form value", () => {
    it("holds every committed value, in order", async () => {
      const onChange = jest.fn();
      const { user } = installerRender(<TestForm onChange={onChange} />);
      await user.type(combobox(), "eth0{Enter}");
      await user.type(combobox(), "eth1{Enter}");

      expect(onChange).toHaveBeenLastCalledWith(["eth0", "eth1"]);
    });
  });
});
