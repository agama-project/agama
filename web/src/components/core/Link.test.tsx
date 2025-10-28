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
import { installerRender } from "~/test-utils";
import { Link } from "~/components/core";

describe("Link", () => {
  it("renders an HTML `a` tag with the `href` attribute set to given `to` prop", () => {
    installerRender(<Link to="somewhere">Agama Link</Link>);
    const link = screen.getByRole("link", { name: "Agama Link" }) as HTMLLinkElement;
    // NOTE: Link uses ReactRouter#useHref hook which is mocked in test-utils.js
    expect(link).toHaveAttribute("href", "somewhere");
  });

  it("does not render as primary when not using a truthy `isPrimary` prop or `variant` is set to primary", () => {
    installerRender(<Link to="somewhere">Agama Link</Link>);
    const link = screen.getByRole("link", { name: "Agama Link" });
    expect(link.classList.contains("pf-m-primary")).not.toBe(true);
  });

  it("renders as primary if `isPrimary` is given", () => {
    installerRender(
      <Link to="somewhere" isPrimary>
        Agama Link
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Agama Link" });
    expect(link.classList.contains("pf-m-primary")).toBe(true);
  });

  it("does not render as primary when `isPrimary` is false", () => {
    installerRender(
      <Link to="somewhere" isPrimary={false}>
        {" "}
        Agama Link
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Agama Link" });
    expect(link.classList.contains("pf-m-primary")).not.toBe(true);
  });

  it("renders as primary if `variant` is 'primary'", () => {
    installerRender(
      <Link to="somewhere" variant="primary">
        Agama Link
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Agama Link" });
    expect(link.classList.contains("pf-m-primary")).toBe(true);
  });

  it("render as primary `variant` is 'primary' even if isPrimary is false", () => {
    installerRender(
      <Link to="somewhere" isPrimary={false} variant="primary">
        {" "}
        Agama Link
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Agama Link" });
    expect(link.classList.contains("pf-m-primary")).toBe(true);
  });

  it("renders it as secondary when neither is given, a truthy `isPrimary` nor `variant`", () => {
    installerRender(<Link to="somewhere">Agama Link</Link>);
    const link = screen.getByRole("link", { name: "Agama Link" });

    expect(link.classList.contains("pf-m-secondary")).toBe(true);
  });

  it("renders it as secondary when isPrimary is false and variant primary is not given", () => {
    installerRender(
      <Link to="somewhere" isPrimary={false}>
        Agama Link
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Agama Link" });
    expect(link.classList.contains("pf-m-secondary")).toBe(true);
  });

  it("does not render it as secondary when variant is primary", () => {
    installerRender(
      // Unexpected, but possible since isPrimary is just a "helper"
      <Link to="somewhere" isPrimary={false} variant="primary">
        Agama Link
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Agama Link" });
    expect(link.classList.contains("pf-m-secondary")).not.toBe(true);
  });

  it("does not render it as secondary when variant is link", () => {
    installerRender(
      <Link to="somewhere" variant="link">
        Agama Link
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Agama Link" });
    expect(link.classList.contains("pf-m-secondary")).not.toBe(true);
  });
});
