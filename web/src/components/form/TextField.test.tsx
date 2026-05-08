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

import type { TextInputProps } from "@patternfly/react-core";

function TextFieldForm({
  defaultValue = "",
  helperText,
  type,
  size,
}: {
  defaultValue?: string;
  helperText?: string;
  type?: TextInputProps["type"];
  size?: number;
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
            <field.TextField label="My label" helperText={helperText} type={type} size={size} />
          )}
        </form.AppField>
        <button type="submit">Submit</button>
      </form>
    </form.AppForm>
  );
}

describe("TextField", () => {
  it("renders the label", () => {
    installerRender(<TextFieldForm />);
    expect(screen.getByLabelText("My label")).toBeInTheDocument();
  });

  it("shows the current value", () => {
    installerRender(<TextFieldForm defaultValue="Hello" />);
    expect(screen.getByLabelText("My label")).toHaveValue("Hello");
  });

  it("updates when the user types", async () => {
    const { user } = installerRender(<TextFieldForm />);
    await user.type(screen.getByLabelText("My label"), "World");
    expect(screen.getByLabelText("My label")).toHaveValue("World");
  });

  it("shows a validation error after a failed submit", async () => {
    const { user } = installerRender(<TextFieldForm />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Text is required");
  });

  describe("helperText", () => {
    it("shows helper text when provided", () => {
      installerRender(<TextFieldForm helperText="E.g., example@example.com" />);
      screen.getByText("E.g., example@example.com");
    });

    it("does not show helper text when not provided", () => {
      installerRender(<TextFieldForm />);
      expect(screen.queryByText("E.g.,")).not.toBeInTheDocument();
    });

    it("shows both helper text and error when there is an error", async () => {
      const { user } = installerRender(<TextFieldForm helperText="E.g., example@example.com" />);
      await user.click(screen.getByRole("button", { name: "Submit" }));
      screen.getByText("E.g., example@example.com");
      await screen.findByText("Text is required");
    });
  });

  describe("type prop", () => {
    it("sets the input type to password when type is password", () => {
      installerRender(<TextFieldForm type="password" />);
      const input = screen.getByLabelText("My label");
      expect(input).toHaveAttribute("type", "password");
    });

    it("sets the input type to email when type is email", () => {
      installerRender(<TextFieldForm type="email" />);
      const input = screen.getByLabelText("My label");
      expect(input).toHaveAttribute("type", "email");
    });

    it("defaults to text type when type is not provided", () => {
      installerRender(<TextFieldForm />);
      const input = screen.getByLabelText("My label");
      expect(input).toHaveAttribute("type", "text");
    });
  });

  describe("size prop", () => {
    it("sets the input size when provided", () => {
      installerRender(<TextFieldForm size={20} />);
      const input = screen.getByLabelText("My label");
      expect(input).toHaveAttribute("size", "20");
    });
  });
});
