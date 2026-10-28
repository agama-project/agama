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

function EmailFieldForm({
  defaultValue = "",
  helperText,
}: {
  defaultValue?: string;
  helperText?: string;
}) {
  const form = useAppForm({ defaultValues: { email: defaultValue } });

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
          name="email"
          validators={{ onSubmit: ({ value }) => (!value ? "Email is required" : undefined) }}
        >
          {(field) => <field.EmailField label="Email address" helperText={helperText} />}
        </form.AppField>
        <button type="submit">Submit</button>
      </form>
    </form.AppForm>
  );
}

describe("EmailField", () => {
  it("renders the label", () => {
    installerRender(<EmailFieldForm />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("renders with type email", () => {
    installerRender(<EmailFieldForm />);
    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
  });

  it("shows the current value", () => {
    installerRender(<EmailFieldForm defaultValue="user@example.com" />);
    expect(screen.getByLabelText("Email address")).toHaveValue("user@example.com");
  });

  it("updates when the user types", async () => {
    const { user } = installerRender(<EmailFieldForm />);
    await user.type(screen.getByLabelText("Email address"), "test@test.com");
    expect(screen.getByLabelText("Email address")).toHaveValue("test@test.com");
  });

  it("shows a validation error after a failed submit", async () => {
    const { user } = installerRender(<EmailFieldForm />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Email is required")).toBeInTheDocument();
  });

  describe("helperText", () => {
    it("shows helper text when provided", () => {
      installerRender(<EmailFieldForm helperText="Used for notifications" />);
      screen.getByText("Used for notifications");
    });

    it("does not show helper text when not provided", () => {
      installerRender(<EmailFieldForm />);
      expect(screen.queryByText("Used for")).not.toBeInTheDocument();
    });

    it("shows both helper text and error when there is an error", async () => {
      const { user } = installerRender(<EmailFieldForm helperText="Used for notifications" />);
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByText("Email is required");
      screen.getByText("Used for notifications");
    });
  });
});
