/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { screen, waitForElementToBeRemoved } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { PageMenu } from "~/components/core";

it("renders the component initially closed", async () => {
  plainRender(
    <PageMenu togglerAriaLabel="Testing menu">
      <PageMenu.Option>A dummy action</PageMenu.Option>
    </PageMenu>
  );

  screen.getByRole("button", { name: "Testing menu" });
  expect(screen.queryByRole("menuitem", { name: "A dummy action" })).toBeNull();
});

it("shows and hides the component content on user request", async () => {
  const { user } = plainRender(
    <PageMenu togglerAriaLabel="Menu toggler">
      <PageMenu.Option><>A dummy action</></PageMenu.Option>
    </PageMenu>
  );

  const toggler = screen.getByRole("button", { name: "Menu toggler" });

  expect(screen.queryByRole("menuitem", { name: "A dummy action" })).toBeNull();

  await user.click(toggler);

  screen.getByRole("menuitem", { name: "A dummy action" });

  await user.click(toggler);
  await waitForElementToBeRemoved(screen.queryByRole("menuitem", { name: "A dummy action" }));
  // NOTE: the above is the same than:
  // await waitFor(() => {
  //   expect(screen.queryByRole("menuitem", { name: "A dummy action" })).toBeNull();
  // });
});

it("hides the component content when user clicks on one of its actions", async () => {
  const { user } = plainRender(
    <PageMenu>
      <PageMenu.Group label="Refresh">
        <PageMenu.Option><>Section</></PageMenu.Option>
        <PageMenu.Option><>Page</></PageMenu.Option>
      </PageMenu.Group>
      <PageMenu.Option><>Exit</></PageMenu.Option>
    </PageMenu>
  );

  const toggler = screen.getByRole("button");
  await user.click(toggler);
  const action = screen.getByRole("menuitem", { name: "Section" });
  await user.click(action);

  expect(screen.queryByRole("menuitem", { name: "A dummy action" })).toBeNull();
});

it('closes the component  when user clicks outside', async () => {
  const { user } = plainRender(
    <>
      <div>Sibling</div>
      <PageMenu>
        <PageMenu.Option><>Option 1</></PageMenu.Option>
        <PageMenu.Option><>Option 2</></PageMenu.Option>
      </PageMenu>
    </>
  );

  const toggler = screen.getByRole("button");
  const sibling = screen.getByText("Sibling");

  // Open the dropdown
  await user.click(toggler);

  // Ensure the dropdown is open
  screen.getByRole("menuitem", { name: "Option 2" });

  // Click outside the dropdown
  await user.click(sibling);

  // Ensure the dropdown is closed
  await waitForElementToBeRemoved(() => screen.queryByRole("menuitem", { name: "Option 2" }));
});
