/*
 * Copyright (c) [2023] SUSE LLC
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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { Icon } from "~/components/layout";

describe("when given a known name", () => {
  it("renders an aria-hidden SVG element", async () => {
    const { container } = plainRender(<Icon name="wifi" />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toHaveAttribute("aria-hidden", "true");
  });
});

describe("when given an unknown name", () => {
  it("renders an informative text", async () => {
    plainRender(<Icon name="apsens" />);
    await screen.findByText("Icon apsens not found!", { name: /options/i });
  });
});
