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
import { Link } from "~/components/core";

describe("Link", () => {
  it("renders an HTML `a` tag with the `href` attribute set to given `to` prop", () => {
    plainRender(<Link to="somewhere">Agama Link</Link>);
    const link = screen.getByRole("link", { name: "Agama Link" }) as HTMLLinkElement;
    // NOTE: Link uses ReactRouter#useHref hook which is mocked in test-utils.js
    expect(link).toHaveAttribute("href", "somewhere");
  });

  it("renders it as primary when either, using a truthy `isPrimary` prop or `variant` is set to primary", () => {
    const { rerender } = plainRender(<Link to="somewhere">Agama Link</Link>);
    const link = screen.getByRole("link", { name: "Agama Link" });

    expect(link.classList.contains("pf-m-primary")).not.toBe(true);

    rerender(
      <Link to="somewhere" isPrimary>
        Agama Link
      </Link>,
    );
    expect(link.classList.contains("pf-m-primary")).toBe(true);

    rerender(
      <Link to="somewhere" isPrimary={false}>
        {" "}
        Agama Link
      </Link>,
    );
    expect(link.classList.contains("pf-m-primary")).not.toBe(true);

    rerender(
      <Link to="somewhere" variant="primary">
        Agama Link
      </Link>,
    );
    expect(link.classList.contains("pf-m-primary")).toBe(true);

    rerender(
      <Link to="somewhere" isPrimary={false} variant="primary">
        {" "}
        Agama Link
      </Link>,
    );
    expect(link.classList.contains("pf-m-primary")).toBe(true);
  });

  it("renders it as secondary when neither is given, a truthy `isPrimary` nor `variant`", () => {
    const { rerender } = plainRender(<Link to="somewhere">Agama Link</Link>);
    const link = screen.getByRole("link", { name: "Agama Link" });

    expect(link.classList.contains("pf-m-secondary")).toBe(true);

    rerender(
      <Link to="somewhere" isPrimary={false}>
        Agama Link
      </Link>,
    );
    expect(link.classList.contains("pf-m-secondary")).toBe(true);

    rerender(
      // Unexpected, but possible since isPrimary is just a "helper"
      <Link to="somewhere" isPrimary={false} variant="primary">
        Agama Link
      </Link>,
    );
    expect(link.classList.contains("pf-m-secondary")).not.toBe(true);

    rerender(
      <Link to="somewhere" variant="link">
        Agama Link
      </Link>,
    );
    expect(link.classList.contains("pf-m-secondary")).not.toBe(true);
  });
});
