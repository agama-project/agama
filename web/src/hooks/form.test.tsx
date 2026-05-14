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
import { usePristineSafeForm } from "./form";

// Dummy form component for testing usePristineSafeForm behavior
function TestForm({
  onSubmitAsync = jest.fn(),
  onSubmit = jest.fn(),
  onSubmitComplete = jest.fn(),
}) {
  const form = usePristineSafeForm({
    defaultValues: { name: "", email: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        onSubmitAsync(value);
      },
    },
    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
    onSubmitComplete,
  });

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <label>
              Name
              <input
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </label>
          )}
        </form.Field>
        <button type="submit">Submit</button>
      </form>
    </form.AppForm>
  );
}

describe("usePristineSafeForm", () => {
  it("skips validation and onSubmit when form is pristine, but calls onSubmitComplete", async () => {
    const onSubmitAsync = jest.fn();
    const onSubmit = jest.fn();
    const onSubmitComplete = jest.fn();

    const { user } = installerRender(
      <TestForm
        onSubmitAsync={onSubmitAsync}
        onSubmit={onSubmit}
        onSubmitComplete={onSubmitComplete}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "Submit" });
    await user.click(submitButton);

    expect(onSubmitAsync).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSubmitComplete).toHaveBeenCalled();
  });

  it("calls validation, onSubmit, and onSubmitComplete when form is dirty", async () => {
    const onSubmitAsync = jest.fn();
    const onSubmit = jest.fn();
    const onSubmitComplete = jest.fn();

    const { user } = installerRender(
      <TestForm
        onSubmitAsync={onSubmitAsync}
        onSubmit={onSubmit}
        onSubmitComplete={onSubmitComplete}
      />,
    );

    const nameInput = screen.getByRole("textbox", { name: "Name" });
    await user.type(nameInput, "John");

    const submitButton = screen.getByRole("button", { name: "Submit" });
    await user.click(submitButton);

    expect(onSubmitAsync).toHaveBeenCalledWith({ name: "John", email: "" });
    expect(onSubmit).toHaveBeenCalledWith({ name: "John", email: "" });
    expect(onSubmitComplete).toHaveBeenCalled();
  });
});
