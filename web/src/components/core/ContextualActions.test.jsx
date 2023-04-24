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
import { screen, within } from "@testing-library/react";
import { plainRender, mockLayout } from "~/test-utils";
import { ContextualActions } from "~/components/core";

jest.mock("~/components/layout/Layout", () => mockLayout());

it("renders the component initially closed", async () => {
  const { user } = plainRender(
    <ContextualActions>
      <ContextualActions.Item>A dummy action</ContextualActions.Item>
    </ContextualActions>
  );

  expect(screen.queryByRole("menuitem", { name: "A dummy action" })).toBeNull();
});

it("show and hide the component content on user request", async () => {
  const { user } = plainRender(
    <ContextualActions>
      <ContextualActions.Item><>A dummy action</></ContextualActions.Item>
    </ContextualActions>
  );

  const toggler = screen.getByRole("button");

  expect(screen.queryByRole("menuitem", { name: "A dummy action" })).toBeNull();

  await user.click(toggler);

  screen.getByRole("menuitem", { name: "A dummy action" });

  await user.click(toggler);

  expect(screen.queryByRole("menuitem", { name: "A dummy action" })).toBeNull();
});

it("hide the component content when the user clicks on one of its actions", async () => {
  const { user } = plainRender(
    <ContextualActions>
      <ContextualActions.Group label="Refresh">
        <ContextualActions.Item><>Section</></ContextualActions.Item>
        <ContextualActions.Item><>Page</></ContextualActions.Item>
      </ContextualActions.Group>
      <ContextualActions.Item><>Exit</></ContextualActions.Item>
    </ContextualActions>
  );

  const toggler = screen.getByRole("button");
  await user.click(toggler);
  const action = screen.getByRole("menuitem", { name: "Section" });
  await user.click(action);

  expect(screen.queryByRole("menuitem", { name: "A dummy action" })).toBeNull();
});
