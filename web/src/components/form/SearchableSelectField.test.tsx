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

type TestOption = {
  value: string;
  label: string;
  description?: React.ReactNode;
  filterText?: string;
};

// filterText carries the full match string (label text plus the hidden code and
// territory), so the list filters by pieces that are not in the visible label.
const OPTIONS: TestOption[] = [
  {
    value: "en_US",
    label: "English",
    description: "United States",
    filterText: "English United States en_US",
  },
  { value: "es_ES", label: "Spanish", description: "Spain", filterText: "Spanish Spain es_ES" },
  {
    value: "es_AR",
    label: "Spanish",
    description: "Argentina",
    filterText: "Spanish Argentina es_AR",
  },
  { value: "de_DE", label: "German", description: "Germany", filterText: "German Germany de_DE" },
];

type TestFormProps = {
  defaultValue?: string;
  clearable?: boolean;
  labelWithDescription?: boolean;
  options?: TestOption[];
  normalizeQuery?: (query: string) => string;
  onOpen?: () => void;
};

function TestForm({
  defaultValue = "",
  clearable = false,
  labelWithDescription = true,
  options = OPTIONS,
  normalizeQuery,
  onOpen,
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
            selectedLabel={labelWithDescription ? (o) => `${o.label} (${o.value})` : undefined}
            normalizeQuery={normalizeQuery}
            onOpen={onOpen}
            options={options}
          />
        )}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.language}>
        {(value) => <p>{`selected:${value || "none"}`}</p>}
      </form.Subscribe>
    </>
  );
}

// Form whose field is required, to exercise the error display on submit.
function RequiredForm() {
  const form = useAppForm({
    defaultValues: { language: "" },
    validators: {
      onSubmit: ({ value }) =>
        value.language ? undefined : { fields: { language: "Value is required" } },
    },
  });

  return (
    <>
      <form.AppField name="language">
        {(field) => (
          <field.SearchableSelectField
            label="Language"
            placeholder="Filter by language or territory"
            noResultsText="No matches"
            options={OPTIONS}
          />
        )}
      </form.AppField>
      <button type="button" onClick={() => form.handleSubmit()}>
        Submit
      </button>
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
    expect(combobox()).toHaveValue("Spanish (es_AR)");
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

  it("filters across the filterText terms regardless of word order", async () => {
    const { user } = installerRender(<TestForm />);
    await user.click(combobox());
    await user.keyboard("argentina spanish");

    // Wait for the debounced filter to reduce the list to the single match.
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByText("Argentina")).toBeInTheDocument();
    expect(screen.queryByText("Spain")).not.toBeInTheDocument();
  });

  it("matches a filterText term that is not part of the visible label", async () => {
    const { user } = installerRender(<TestForm />);
    await user.click(combobox());
    // "es_AR" appears only in filterText (the code), never in the "Spanish" label.
    await user.keyboard("es_ar");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByText("Argentina")).toBeInTheDocument();
    expect(screen.queryByText("Spain")).not.toBeInTheDocument();
  });

  it("falls back to matching the label when filterText is omitted", async () => {
    const options: TestOption[] = [
      { value: "en_US", label: "English" },
      { value: "de_DE", label: "German" },
    ];
    const { user } = installerRender(<TestForm options={options} />);
    await user.click(combobox());
    await user.keyboard("german");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByText("German")).toBeInTheDocument();
  });

  it("calls onOpen when the list opens", async () => {
    const onOpen = jest.fn();
    const { user } = installerRender(<TestForm onOpen={onOpen} />);
    await user.click(combobox());

    await screen.findByRole("listbox");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("matches regardless of diacritics", async () => {
    const options: TestOption[] = [
      { value: "en", label: "Inglés", filterText: "Inglés English" },
      { value: "de", label: "Alemán", filterText: "Alemán German" },
    ];
    const { user } = installerRender(<TestForm options={options} />);
    await user.click(combobox());
    // Typing without the accent still matches the accented option.
    await user.keyboard("ingles");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByText("Inglés")).toBeInTheDocument();
  });

  it("ignores bracket punctuation so a committed selection still matches", async () => {
    // The selectedLabel reads "Spanish (Spain)" but the filterText has no
    // parentheses; pasting or autocompleting the label back in must still match.
    const { user } = installerRender(<TestForm />);
    await user.click(combobox());
    await user.keyboard("Spanish (Spain)");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByText("Spain")).toBeInTheDocument();
    expect(screen.queryByText("Argentina")).not.toBeInTheDocument();
  });

  it("matches using the rewritten query when normalizeQuery is given", async () => {
    const options: TestOption[] = [
      {
        value: "utc",
        label: "Coordinated Universal Time",
        filterText: "Coordinated Universal Time UTC",
      },
      { value: "berlin", label: "Berlin", filterText: "Berlin Europe +1" },
    ];
    const { user } = installerRender(
      <TestForm options={options} normalizeQuery={(q) => q.replace(/\butc\s*([+-])/gi, "$1")} />,
    );
    await user.click(combobox());
    // "UTC+1" is rewritten to "+1", which only the Berlin option stores.
    await user.keyboard("UTC+1");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByText("Berlin")).toBeInTheDocument();
  });

  it("matches a query that normalizeQuery leaves untouched", async () => {
    const options: TestOption[] = [
      {
        value: "utc",
        label: "Coordinated Universal Time",
        filterText: "Coordinated Universal Time UTC",
      },
      { value: "berlin", label: "Berlin", filterText: "Berlin Europe +1" },
    ];
    const { user } = installerRender(
      <TestForm options={options} normalizeQuery={(q) => q.replace(/\butc\s*([+-])/gi, "$1")} />,
    );
    await user.click(combobox());
    // Bare "utc" has no offset sign, so it is matched as typed: only the
    // Coordinated Universal Time option carries it.
    await user.keyboard("utc");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByText("Coordinated Universal Time")).toBeInTheDocument();
  });

  it("renders a ReactNode description but does not search it", async () => {
    const options: TestOption[] = [
      {
        value: "en_US",
        label: "English",
        description: <span>shown-not-searched</span>,
        filterText: "English en_US",
      },
    ];
    const { user } = installerRender(<TestForm options={options} />);
    await user.click(combobox());

    // The node renders in the open list.
    expect(await screen.findByText("shown-not-searched")).toBeInTheDocument();

    // Typing the description text matches nothing: it is not part of filterText.
    await user.keyboard("shown-not-searched");
    await screen.findByText("No matches");
  });

  it("shows the validation error and marks the field invalid on submit", async () => {
    const { user } = installerRender(<RequiredForm />);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Value is required")).toBeInTheDocument();
    expect(combobox()).toHaveAttribute("aria-invalid", "true");
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
    expect(combobox()).toHaveValue("German (de_DE)");
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
    expect(combobox()).toHaveValue("Spanish (es_ES)");
  });
});
