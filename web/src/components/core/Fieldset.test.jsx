/*
 * Copyright (c) [2022] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { screen, within } from "@testing-library/react";
import { installerRender } from "@/test-utils";
import { Fieldset } from "@components/core";

const ComplexLegend = () => {
  return (
    <>
      <label htmlFor="active-fieldset">Using a checkbox in the legend</label>
      <input type="checkbox" id="active-fieldset" />
    </>
  );
};

describe("Fieldset", () => {
  it("renders a group element", () => {
    installerRender(<Fieldset />);
    const fieldset = screen.getByRole("group");
    expect(fieldset).toBeInTheDocument();
  });

  it("renders the given legend", () => {
    installerRender(<Fieldset legend="Simple legend" />);
    screen.getByRole("group", { name: /Simple legend/i });
  });

  it("allows using a complex legend", () => {
    installerRender(<Fieldset legend={<ComplexLegend />} />);
    const fieldset = screen.getByRole("group", { name: /Using a checkbox.*/i });
    const checkbox = within(fieldset).getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
  });

  it("sets children (except legend) as disabled when isDisabled prop is given", () => {
    installerRender(
      <Fieldset legend={<ComplexLegend />} isDisabled>
        <label htmlFor="username">Username</label>
        <input type="text" id="username" />
        <label htmlFor="superuser">Superuser</label>
        <input type="checkbox" id="superuser" />
      </Fieldset>
    );

    const fieldset = screen.getByRole("group", { name: /Using a checkbox/i });
    const legendCheckbox = within(fieldset).getByRole("checkbox", { name: "Using a checkbox in the legend" });
    const inputText = within(fieldset).getByRole("textbox", { name: "Username" });
    const checkbox = within(fieldset).getByRole("checkbox", { name: "Superuser" });

    expect(fieldset).toHaveAttribute("disabled");
    expect(legendCheckbox).not.toBeDisabled();
    expect(inputText).toBeDisabled();
    expect(checkbox).toBeDisabled();
  });
});
