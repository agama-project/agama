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
import SubmitButton from "~/components/form/SubmitButton";

function TestForm({ label }: { label?: string }) {
  const form = useAppForm({ defaultValues: {} });
  return (
    <form.AppForm>
      <SubmitButton label={label} />
    </form.AppForm>
  );
}

describe("SubmitButton", () => {
  it("renders a submit button with the default label", () => {
    installerRender(<TestForm />);
    expect(screen.getByRole("button", { name: "Accept" })).toHaveAttribute("type", "submit");
  });

  it("renders a submit button with a custom label", () => {
    installerRender(<TestForm label="Save" />);
    screen.getByRole("button", { name: "Save" });
  });

  it("is enabled and not loading when the form is idle", () => {
    installerRender(<TestForm />);
    const button = screen.getByRole("button", { name: "Accept" });
    expect(button).not.toBeDisabled();
  });
});
