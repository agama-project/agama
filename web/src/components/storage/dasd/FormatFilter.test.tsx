/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { N_ } from "~/i18n";
import FormatFilter from "./FormatFilter";

const onChangeFn = jest.fn();

const selectOptions = {
  all: N_("All"),
  yes: N_("Yes"),
  no: N_("No"),
};

describe("DASD/FormatFilter", () => {
  it("renders a select menu to filter DASD devices by format status", async () => {
    const { user } = plainRender(
      <FormatFilter value="all" options={selectOptions} onChange={onChangeFn} />,
    );
    // Not using the label name to retrieve the MenuToggle button because a bug
    // PF/MenuToggle has, check
    // https://github.com/patternfly/patternfly-react/issues/11805
    const toggle = screen.getByRole("button");
    await user.click(toggle);
    const options = screen.getByRole("listbox");
    within(options).getByRole("option", { name: "All" });
    within(options).getByRole("option", { name: "Yes" });
    within(options).getByRole("option", { name: "No" });
  });

  it("calls onChange when a format option is selected", async () => {
    const { user } = plainRender(
      <FormatFilter value="all" options={selectOptions} onChange={onChangeFn} />,
    );
    const toggle = screen.getByRole("button");
    await user.click(toggle);
    const options = screen.getByRole("listbox");
    const activeOption = within(options).getByRole("option", { name: "Yes" });
    await user.click(activeOption);
    expect(onChangeFn).toHaveBeenCalledWith(expect.anything(), "yes");
  });
});
