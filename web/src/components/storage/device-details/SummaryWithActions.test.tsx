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
import SummaryWithActions from "~/components/storage/device-details/SummaryWithActions";

describe("SummaryWithActions", () => {
  it("says its summary in bold, as a paragraph rather than a heading", () => {
    plainRender(<SummaryWithActions summary="Not used yet" />);

    expect(screen.getByText("Not used yet")).toHaveClass("pf-v6-u-font-weight-bold");
    expect(screen.queryByRole("heading")).toBeNull();
    screen.getByRole("paragraph");
  });

  it("adds the detail under the summary, where there is one", () => {
    plainRender(<SummaryWithActions summary="Not used yet" detail="Add partitions to it." />);

    expect(screen.getAllByRole("paragraph").map((p) => p.textContent)).toEqual([
      "Not used yet",
      "Add partitions to it.",
    ]);
  });

  it("shows its actions after the text", () => {
    plainRender(
      <SummaryWithActions summary="Not used yet" actions={<button>Add partition</button>} />,
    );

    const action = screen.getByRole("button", { name: "Add partition" });
    expect(screen.getByRole("paragraph").compareDocumentPosition(action)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
