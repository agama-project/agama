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
import { plainRender } from "~/test-utils";
import { formOptions } from "@tanstack/react-form";
import { useAppForm } from "~/hooks/form";
import { _ } from "~/i18n";
import RadioGroupField from "./RadioGroupField";

type FormFields = {
  choice: string;
};

const defaultValues: FormFields = {
  choice: "option1",
};

const defaultOptions = formOptions({ defaultValues });

const TestForm = ({ onSubmit = jest.fn() }: { onSubmit?: () => void }) => {
  const form = useAppForm({
    ...defaultOptions,
    onSubmit: async () => {
      onSubmit();
    },
  });

  return (
    <form.AppForm>
      <form.AppField name="choice">
        {() => (
          <RadioGroupField
            label={_("Choose an option")}
            options={[
              { value: "option1", label: _("Option 1"), description: "First option" },
              { value: "option2", label: _("Option 2"), description: "Second option" },
              {
                value: "option3",
                label: _("Option 3"),
                description: "Third option",
                isDisabled: true,
              },
            ]}
            helperText="Pick one option"
          />
        )}
      </form.AppField>
    </form.AppForm>
  );
};

describe("RadioGroupField", () => {
  it("renders all radio options", () => {
    plainRender(<TestForm />);

    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 3")).toBeInTheDocument();
  });

  it("renders option descriptions", () => {
    plainRender(<TestForm />);

    expect(screen.getByText("First option")).toBeInTheDocument();
    expect(screen.getByText("Second option")).toBeInTheDocument();
    expect(screen.getByText("Third option")).toBeInTheDocument();
  });

  it("renders helper text", () => {
    plainRender(<TestForm />);

    expect(screen.getByText("Pick one option")).toBeInTheDocument();
  });

  it("checks the option matching the field value", () => {
    plainRender(<TestForm />);

    const option1 = screen.getByLabelText("Option 1") as HTMLInputElement;
    const option2 = screen.getByLabelText("Option 2") as HTMLInputElement;

    expect(option1.checked).toBe(true);
    expect(option2.checked).toBe(false);
  });

  it("disables options marked as disabled", () => {
    plainRender(<TestForm />);

    const option3 = screen.getByLabelText("Option 3") as HTMLInputElement;
    expect(option3.disabled).toBe(true);
  });

  it("updates field value when option is selected", async () => {
    const { user } = plainRender(<TestForm />);

    const option2 = screen.getByLabelText("Option 2");
    await user.click(option2);

    const option2Input = option2 as HTMLInputElement;
    expect(option2Input.checked).toBe(true);
  });
});

describe("RadioGroupField with children render prop", () => {
  const TestFormWithChildren = () => {
    const form = useAppForm({
      ...defaultOptions,
      onSubmit: async () => {},
    });

    return (
      <form.AppForm>
        <form.AppField name="choice">
          {() => (
            <RadioGroupField
              label={_("Choose an option")}
              options={[
                { value: "option1", label: _("Option 1") },
                { value: "option2", label: _("Option 2") },
              ]}
            >
              {(value) => value === "option2" && <div>Additional content for option 2</div>}
            </RadioGroupField>
          )}
        </form.AppField>
      </form.AppForm>
    );
  };

  it("renders children based on selected value", async () => {
    const { user } = plainRender(<TestFormWithChildren />);

    expect(screen.queryByText("Additional content for option 2")).not.toBeInTheDocument();

    const option2 = screen.getByLabelText("Option 2");
    await user.click(option2);

    expect(screen.getByText("Additional content for option 2")).toBeInTheDocument();
  });
});
