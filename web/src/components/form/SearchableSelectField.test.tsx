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
import { formOptions } from "@tanstack/react-form";

const testFormOptions = formOptions({
  defaultValues: {
    language: "",
  },
});

function TestForm({ defaultValue = "" }: { defaultValue?: string }) {
  const form = useAppForm({
    ...testFormOptions,
    defaultValues: {
      language: defaultValue,
    },
  });

  const options = [
    { value: "en_US", label: "English", description: "United States" },
    { value: "es_ES", label: "Spanish", description: "Spain" },
    { value: "de_DE", label: "German", description: "Germany" },
  ];

  return (
    <form.AppForm>
      <form.AppField name="language">
        {(field) => <field.SearchableSelectField label="Language" options={options} />}
      </form.AppField>
    </form.AppForm>
  );
}

describe("SearchableSelectField", () => {
  it("renders the label", () => {
    installerRender(<TestForm />);
    screen.getByText("Language");
  });

  it("shows placeholder when no value is selected", () => {
    installerRender(<TestForm />);
    screen.getByText("Select an option");
  });

  it("shows selected option", () => {
    installerRender(<TestForm defaultValue="es_ES" />);
    screen.getByText("Spanish - Spain");
  });

  it("allows selecting an option", async () => {
    const { user } = installerRender(<TestForm />);

    const toggle = screen.getByRole("button", { name: "Language" });
    await user.click(toggle);

    const option = screen.getByRole("option", { name: /English/ });
    await user.click(option);

    screen.getByText("English - United States");
  });

  it("allows filtering options by typing", async () => {
    const { user } = installerRender(<TestForm />);

    const toggle = screen.getByRole("button", { name: "Language" });
    await user.click(toggle);

    const filterInput = screen.getByPlaceholderText("Type to filter");
    await user.type(filterInput, "Ger");

    expect(screen.queryByRole("option", { name: /English/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Spanish/ })).not.toBeInTheDocument();
    screen.getByRole("option", { name: /German/ });
  });

  it("shows no options message when filter matches nothing", async () => {
    const { user } = installerRender(<TestForm />);

    const toggle = screen.getByRole("button", { name: "Language" });
    await user.click(toggle);

    const filterInput = screen.getByPlaceholderText("Type to filter");
    await user.type(filterInput, "xyz");

    screen.getByText("No options found");
  });

  it("allows clearing the filter", async () => {
    const { user } = installerRender(<TestForm />);

    const toggle = screen.getByRole("button", { name: "Language" });
    await user.click(toggle);

    const filterInput = screen.getByPlaceholderText("Type to filter");
    await user.type(filterInput, "Ger");

    const clearButton = screen.getByRole("button", { name: "Clear filter" });
    await user.click(clearButton);

    screen.getByRole("option", { name: /English/ });
    screen.getByRole("option", { name: /Spanish/ });
    screen.getByRole("option", { name: /German/ });
  });
});
