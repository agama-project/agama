/*
 * Copyright (c) [2024] SUSE LLC
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
import { _ } from "~/i18n";
import TreeTable from "./TreeTable";

const columns = () => [{ name: _("Name"), value: (item: { name: string }) => item.name }];
const items = [{ name: "vda" }];

describe("TreeTable", () => {
  it.todo("add examples for testing core/TreeTable component");

  it("keeps rows' cells at their top by default", () => {
    plainRender(
      <TreeTable columns={columns()} items={items} className="custom" aria-label="Devices" />,
    );
    const table = screen.getByRole("treegrid", { name: "Devices" });
    expect(table).toHaveClass("custom");
    expect(table).not.toHaveClass("agm-table--vertically-centered-rows");
  });

  it("centers rows' cells vertically when asked to, keeping the given class names", () => {
    plainRender(
      <TreeTable
        columns={columns()}
        items={items}
        className="custom"
        hasVerticallyCenteredRows
        aria-label="Devices"
      />,
    );
    const table = screen.getByRole("treegrid", { name: "Devices" });
    expect(table).toHaveClass("custom", "agm-table--vertically-centered-rows");
  });
});
