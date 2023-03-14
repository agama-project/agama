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
import { Disclosure } from "~/components/core";

describe("Disclosure", () => {
  it("renders a button with given label", () => {
    plainRender(<Disclosure label="Developer tools">The disclosed content</Disclosure>);

    screen.getByRole("button", { name: "Developer tools" });
  });

  it("renders a panel with given children", () => {
    plainRender(
      <Disclosure label="Developer tools">
        <a href="#">A disclosed link</a>
        <p>A disclosed paragraph</p>
      </Disclosure>
    );

    screen.getByRole("link", { name: "A disclosed link" });
    screen.getByText("A disclosed paragraph");
  });

  it("renders it initially collapsed", () => {
    plainRender(<Disclosure label="Developer tools">The disclosed content</Disclosure>);
    const button = screen.getByRole("button", { name: "Developer tools" });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("expands it when user clicks on the button ", async () => {
    const { user } = plainRender(<Disclosure label="Developer tools">The disclosed content</Disclosure>);
    const button = screen.getByRole("button", { name: "Developer tools" });

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
