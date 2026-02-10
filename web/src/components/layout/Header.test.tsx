/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import type { Product } from "~/model/system";
import Header from "./Header";

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  description: "Tumbleweed description...",
  registration: false,
  modes: [],
};

jest.mock("~/hooks/model/config/product", () => ({
  ...jest.requireActual("~/hooks/model/config/product"),
  useProductInfo: (): Product => tumbleweed,
}));

describe("Header", () => {
  it("renders given title as heading level 1", () => {
    plainRender(<Header title={tumbleweed.name} />);
    screen.getByRole("heading", { name: tumbleweed.name, level: 1 });
  });

  it("renders skip to content link", async () => {
    plainRender(<Header />);
    screen.getByRole("link", { name: "Skip to content" });
  });

  it("does not render skip to content link when hideSkipToContent is truthy", async () => {
    const { rerender } = plainRender(<Header hideSkipToContent />);
    expect(screen.queryByRole("link", { name: "Skip to content" })).toBeNull();
    rerender(<Header hideSkipToContent={false} />);
    screen.queryByRole("link", { name: "Skip to content" });
  });

  it("renders given content for slots", () => {
    plainRender(
      <Header
        title="Storage"
        startSlot={<div role="progressbar" aria-label="Installation progress" />}
        centerSlot={
          <div role="menu" aria-label="Page actions">
            <button role="menuitem">Export configuration</button>
            <button role="menuitem">Advanced settings</button>
          </div>
        }
        endSlot={<button>Install</button>}
      />,
    );

    screen.getByRole("progressbar", { name: "Installation progress" });
    screen.getByRole("menu", { name: "Page actions" });
    screen.getByRole("button", { name: "Install" });
  });
});
