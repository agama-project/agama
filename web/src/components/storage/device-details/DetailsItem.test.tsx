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
import DetailsItem from "~/components/storage/device-details/DetailsItem";

describe("DetailsItem", () => {
  it("shows its name, its value and what it says under them", () => {
    plainRender(
      <DetailsItem icon="rotate_auto" name="Boot" value="partitions configured here">
        This disk was automatically chosen for booting.
      </DetailsItem>,
    );

    screen.getByText("Boot");
    screen.getByText("partitions configured here");
    screen.getByText("This disk was automatically chosen for booting.");
  });

  it("keeps its icon out of what screen readers read", () => {
    const { container } = plainRender(<DetailsItem icon="rotate_auto" name="Boot" />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows no icon when given none", () => {
    const { container } = plainRender(<DetailsItem value="Automatically chosen for booting." />);

    expect(container.querySelector("svg")).toBeNull();
  });
});
