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
import ProductLogo from "./ProductLogo";

const product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
  registration: false,
};

describe("ProductLogo", () => {
  it("renders nothing when product is null", () => {
    const { container } = plainRender(<ProductLogo product={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when product is undefined", () => {
    const { container } = plainRender(<ProductLogo product={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the logo image with correct src and alt text", () => {
    plainRender(<ProductLogo product={product} />);

    const img = screen.getByRole("img", { hidden: true });
    expect(img).toHaveAttribute("src", "assets/logos/tumbleweed.svg");
    expect(img).toHaveAttribute("alt", "openSUSE Tumbleweed logo");
  });

  it("applies default width of 80px", () => {
    plainRender(<ProductLogo product={product} />);

    const img = screen.getByRole("img", { hidden: true });
    expect(img).toHaveAttribute("width", "80px");
    expect(img).toHaveStyle({ width: "80px" });
  });

  it("applies custom width when provided", () => {
    plainRender(<ProductLogo product={product} width="120px" />);

    const img = screen.getByRole("img", { hidden: true });
    expect(img).toHaveAttribute("width", "120px");
    expect(img).toHaveStyle({ width: "120px" });
  });

  it("applies vertical align middle style", () => {
    plainRender(<ProductLogo product={product} />);

    const img = screen.getByRole("img", { hidden: true });
    expect(img).toHaveStyle({ verticalAlign: "middle" });
  });
});
