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
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";

const OPTIONS = [
  { value: "en_US", label: "English", description: "United States" },
  { value: "es_ES", label: "Spanish", description: "Spain" },
  { value: "es_AR", label: "Spanish", description: "Argentina" },
  { value: "de_DE", label: "German", description: "Germany" },
];

type TestFormProps = {
  defaultValue?: string;
  clearable?: boolean;
  labelWithDescription?: boolean;
};

function TestForm({
  defaultValue = "",
  clearable = false,
  labelWithDescription = true,
}: TestFormProps) {
  const form = useAppForm({ defaultValues: { language: defaultValue } });

  return (
    <>
      <form.AppField name="language">
        {(field) => (
          <field.SearchableSelectField
            label="Language"
            placeholder="Filter by language or territory"
            emptyPlaceholder="Choose an option"
            noResultsText="No matches"
            clearable={clearable}
            selectedLabel={
              labelWithDescription ? (o) => `${o.label} (${o.description})` : undefined
            }
            options={OPTIONS}
          />
        )}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.language}>
        {(value) => <p>{`selected:${value || "none"}`}</p>}
      </form.Subscribe>
    </>
  );
}

const combobox = () => screen.getByRole("combobox", { name: "Language" });

beforeAll(() => {
  // jsdom does not implement scrollIntoView; the field calls it when opening.
  // https://github.com/jsdom/jsdom/issues/1695
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

describe("SearchableSelectField", () => {
  it("renders an accessible combobox labelled by the field label", () => {
    installerRender(<TestForm />);
    expect(combobox()).toBeInTheDocument();
  });

  it("focuses the input when the visible label is clicked", async () => {
    const { user } = installerRender(<TestForm />);
    await user.click(screen.getByText("Language"));
    expect(combobox()).toHaveFocus();
  });

  it("shows the committed selection via selectedLabel in the closed input", () => {
    installerRender(<TestForm defaultValue="es_AR" />);
    expect(combobox()).toHaveValue("Spanish (Argentina)");
  });

  it("shows only the option label in the closed input when selectedLabel is omitted", () => {
    installerRender(<TestForm defaultValue="es_AR" labelWithDescription={false} />);
    expect(combobox()).toHaveValue("Spanish");
  });

  it("shows the resting prompt while empty and unfocused", () => {
    installerRender(<TestForm />);
    expect(combobox()).toHaveAttribute("placeholder", "Choose an option");
  });

  it("lists the options when opened", async () => {
    const { user } = installerRender(<TestForm />);
    await user.click(combobox());
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(OPTIONS.length);
  });

  it("filters across label and description regardless of word order", async () => {
    const { user } = installerRender(<TestForm />);
    await user.click(combobox());
    await user.keyboard("argentina spanish");

    // Wait for the debounced filter to reduce the list to the single match.
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByText("Argentina")).toBeInTheDocument();
    expect(screen.queryByText("Spain")).not.toBeInTheDocument();
  });

  it("shows the no-results text when nothing matches", async () => {
    const { user } = installerRender(<TestForm />);
    await user.click(combobox());
    await user.keyboard("zzzzz");
    await screen.findByText("No matches");
  });

  it("selects an option by mouse", async () => {
    const { user } = installerRender(<TestForm />);
    await user.click(combobox());
    await user.click(await screen.findByText("German"));
    expect(screen.getByText("selected:de_DE")).toBeInTheDocument();
    expect(combobox()).toHaveValue("German (Germany)");
  });

  it("commits the first match with Tab after filtering", async () => {
    const { user } = installerRender(<TestForm />);
    await user.click(combobox());
    await user.keyboard("german");
    // Wait for the debounced filter so the single match is the highlighted one.
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    await user.tab();
    expect(screen.getByText("selected:de_DE")).toBeInTheDocument();
  });

  it("does not commit anything when leaving with an empty query", async () => {
    const { user } = installerRender(<TestForm defaultValue="es_ES" />);
    await user.click(combobox());
    await user.clear(combobox());
    await user.tab();
    expect(screen.getByText("selected:es_ES")).toBeInTheDocument();
  });

  it("clears the selection when leaving empty and clearable", async () => {
    const { user } = installerRender(<TestForm defaultValue="es_ES" clearable />);
    await user.click(combobox());
    await user.clear(combobox());
    await user.tab();
    expect(screen.getByText("selected:none")).toBeInTheDocument();
  });

  it("reverts to the current selection on Escape", async () => {
    const { user } = installerRender(<TestForm defaultValue="es_ES" />);
    await user.click(combobox());
    await user.keyboard("germ");
    await user.keyboard("{Escape}");
    expect(screen.getByText("selected:es_ES")).toBeInTheDocument();
    expect(combobox()).toHaveValue("Spanish (Spain)");
  });
});
