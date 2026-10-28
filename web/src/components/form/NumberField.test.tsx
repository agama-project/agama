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

function NumberFieldForm({ defaultValue = 0 }: { defaultValue?: number }) {
  const form = useAppForm({ defaultValues: { val: defaultValue } });

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.AppField
          name="val"
          validators={{ onSubmit: ({ value }) => (value < 10 ? "Value too small" : undefined) }}
        >
          {(field) => <field.NumberField label="My number" />}
        </form.AppField>
        <button type="submit">Submit</button>
      </form>
    </form.AppForm>
  );
}

describe("NumberField", () => {
  it("renders the label", () => {
    installerRender(<NumberFieldForm />);
    expect(screen.getByLabelText("My number")).toBeInTheDocument();
  });

  it("shows the current value", () => {
    installerRender(<NumberFieldForm defaultValue={42} />);
    expect(screen.getByLabelText("My number")).toHaveValue(42);
  });

  it("updates when the user types", async () => {
    const { user } = installerRender(<NumberFieldForm />);
    const input = screen.getByLabelText("My number");
    await user.clear(input);
    await user.type(input, "123");
    expect(input).toHaveValue(123);
  });

  it("shows a validation error after a failed submit", async () => {
    const { user } = installerRender(<NumberFieldForm defaultValue={5} />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Value too small")).toBeInTheDocument();
  });

  it("applies min and max attributes", () => {
    function RangeForm() {
      const form = useAppForm({ defaultValues: { val: 50 } });
      return (
        <form.AppForm>
          <form.AppField name="val">
            {(field) => <field.NumberField label="Range" min={10} max={100} />}
          </form.AppField>
        </form.AppForm>
      );
    }
    installerRender(<RangeForm />);
    const input = screen.getByLabelText("Range");
    expect(input).toHaveAttribute("min", "10");
    expect(input).toHaveAttribute("max", "100");
  });
});
