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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { _ } from "~/i18n";
import SimpleSelector from "./SimpleSelector";

const onChangeFn = jest.fn();

describe("SimpleSelector", () => {
  const selectOptions = {
    all: _("All"),
    active: _("Active"),
    offline: _("Offline"),
  };

  it("renders a select menu with given options", async () => {
    const { user } = plainRender(
      <SimpleSelector
        label={_("Status")}
        value="all"
        options={selectOptions}
        onChange={onChangeFn}
      />,
    );

    // Not using the label name to retrieve the MenuToggle button because of a bug
    // in PF/MenuToggle, check
    // https://github.com/patternfly/patternfly-react/issues/11805
    const toggle = screen.getByRole("button");
    await user.click(toggle);

    const options = screen.getByRole("listbox");
    within(options).getByRole("option", { name: "All" });
    within(options).getByRole("option", { name: "Active" });
    within(options).getByRole("option", { name: "Offline" });
  });

  it("renders the given label", () => {
    plainRender(
      <SimpleSelector
        label={_("Status")}
        value="all"
        options={selectOptions}
        onChange={onChangeFn}
      />,
    );

    screen.getByText("Status");
  });

  it("renders the current value in the toggle", () => {
    plainRender(
      <SimpleSelector
        label={_("Status")}
        value="active"
        options={selectOptions}
        onChange={onChangeFn}
      />,
    );

    const toggle = screen.getByRole("button");
    expect(toggle).toHaveTextContent("Active");
  });

  it("calls onChange when an option is selected", async () => {
    const { user } = plainRender(
      <SimpleSelector
        label={_("Status")}
        value="all"
        options={selectOptions}
        onChange={onChangeFn}
      />,
    );

    const toggle = screen.getByRole("button");
    await user.click(toggle);

    const options = screen.getByRole("listbox");
    const activeOption = within(options).getByRole("option", { name: "Active" });
    await user.click(activeOption);

    expect(onChangeFn).toHaveBeenCalledWith(expect.anything(), "active");
  });

  it("closes the menu after selecting an option", async () => {
    const { user } = plainRender(
      <SimpleSelector
        label={_("Status")}
        value="all"
        options={selectOptions}
        onChange={onChangeFn}
      />,
    );

    const toggle = screen.getByRole("button");
    await user.click(toggle);
    const options = screen.getByRole("listbox");
    expect(options).toBeVisible();

    await user.click(within(options).getByRole("option", { name: "Active" }));
    expect(options).not.toBeVisible();
  });
});
