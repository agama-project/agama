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

function SuggestionsTextFieldForm({
  defaultValue = "",
  helperText,
  suggestions = [],
}: {
  defaultValue?: string;
  helperText?: string;
  suggestions?: string[];
}) {
  const form = useAppForm({ defaultValues: { text: defaultValue } });

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
          name="text"
          validators={{ onSubmit: ({ value }) => (!value ? "Text is required" : undefined) }}
        >
          {(field) => (
            <field.SuggestionsTextField
              label="Username"
              helperText={helperText}
              suggestions={suggestions}
            />
          )}
        </form.AppField>
        <button type="submit">Submit</button>
      </form>
    </form.AppForm>
  );
}

describe("SuggestionsTextField", () => {
  it("renders the label", () => {
    installerRender(<SuggestionsTextFieldForm />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("shows the current value", () => {
    installerRender(<SuggestionsTextFieldForm defaultValue="john" />);
    expect(screen.getByLabelText("Username")).toHaveValue("john");
  });

  it("updates when the user types", async () => {
    const { user } = installerRender(<SuggestionsTextFieldForm />);
    await user.type(screen.getByLabelText("Username"), "alice");
    expect(screen.getByLabelText("Username")).toHaveValue("alice");
  });

  it("shows a validation error after a failed submit", async () => {
    const { user } = installerRender(<SuggestionsTextFieldForm />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Text is required");
  });

  describe("suggestions", () => {
    it("renders a datalist with suggestions", () => {
      const { container } = installerRender(
        <SuggestionsTextFieldForm suggestions={["admin", "user", "guest"]} />,
      );
      const datalist = container.querySelector("datalist");
      expect(datalist).toBeInTheDocument();
      expect(datalist?.querySelectorAll("option")).toHaveLength(3);
    });

    it("links the input to the datalist", () => {
      const { container } = installerRender(
        <SuggestionsTextFieldForm suggestions={["admin", "user"]} />,
      );
      const input = screen.getByLabelText("Username");
      const datalist = container.querySelector("datalist");
      expect(input).toHaveAttribute("list", datalist?.id);
    });

    it("renders empty datalist when no suggestions provided", () => {
      const { container } = installerRender(<SuggestionsTextFieldForm />);
      const datalist = container.querySelector("datalist");
      expect(datalist?.querySelectorAll("option")).toHaveLength(0);
    });
  });

  describe("helperText", () => {
    it("shows helper text when provided", () => {
      installerRender(<SuggestionsTextFieldForm helperText="Choose a username" />);
      screen.getByText("Choose a username");
    });

    it("does not show helper text when not provided", () => {
      installerRender(<SuggestionsTextFieldForm />);
      expect(screen.queryByText("Choose a")).not.toBeInTheDocument();
    });

    it("shows both helper text and error when there is an error", async () => {
      const { user } = installerRender(<SuggestionsTextFieldForm helperText="Choose a username" />);
      await user.click(screen.getByRole("button", { name: "Submit" }));
      screen.getByText("Choose a username");
      await screen.findByText("Text is required");
    });
  });
});
