/*
 * Copyright (c) [2022] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { plainRender, mockComponent, mockLayout } from "~/test-utils";
import { Sidebar } from "~/components/core";

jest.mock("~/components/layout/Layout", () => mockLayout());
jest.mock("~/components/core/About", () => mockComponent("About Mock"));
jest.mock("~/components/core/ChangeProductButton", () => mockComponent("ChangeProductButton Mock"));
jest.mock("~/components/core/LogsButton", () => mockComponent("LogsButton Mock"));
jest.mock("~/components/network/TargetIpsPopup", () => mockComponent("Host Ips Mock"));

it("renders the sidebar initially hidden", async () => {
  plainRender(<Sidebar />);
  const nav = await screen.findByRole("navigation", { name: /options/i });
  expect(nav).toHaveAttribute("data-state", "hidden");
});

it("renders a link for displaying the sidebar", async () => {
  const { user } = plainRender(<Sidebar />);

  const link = await screen.findByLabelText(/Open/i);
  const nav = await screen.findByRole("navigation", { name: /options/i });

  expect(nav).toHaveAttribute("data-state", "hidden");
  await user.click(link);
  expect(nav).toHaveAttribute("data-state", "visible");
});

it("renders a link for hidding the sidebar", async () => {
  const { user } = plainRender(<Sidebar />);

  const openLink = await screen.findByLabelText(/Open/i);
  const closeLink = await screen.findByLabelText(/Close/i);

  const nav = await screen.findByRole("navigation", { name: /options/i });

  await user.click(openLink);
  expect(nav).toHaveAttribute("data-state", "visible");
  await user.click(closeLink);
  expect(nav).toHaveAttribute("data-state", "hidden");
});

describe("Sidebar content", () => {
  it("contains the component for changing the selected product", async () => {
    plainRender(<Sidebar />);
    const nav = await screen.findByRole("navigation", { name: /options/i });
    await within(nav).findByText("ChangeProductButton Mock");
  });

  it("contains the component for displaying the 'About' information", async () => {
    plainRender(<Sidebar />);
    const nav = await screen.findByRole("navigation", { name: /options/i });
    await within(nav).findByText("About Mock");
  });

  it("contains the component for displaying the 'Host Ips' information", async () => {
    plainRender(<Sidebar />);
    const nav = await screen.findByRole("navigation", { name: /options/i });
    await within(nav).findByText("Host Ips Mock");
  });

  it("contains the components for downloading the logs", async () => {
    plainRender(<Sidebar />);
    const nav = await screen.findByRole("navigation", { name: /options/i });
    await within(nav).findByText("LogsButton Mock");
  });
});
