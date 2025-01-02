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
import { IAction } from "@patternfly/react-table";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { RowActions } from "~/components/core";
import { Icon } from "../layout";
import { _ } from "~/i18n";

const mockEditFn = jest.fn();
const mockDeleteFn = jest.fn();

const actions: IAction[] = [
  {
    title: _("Edit"),
    role: "link",
    "aria-label": _("Dummy edit action"),
    onClick: mockEditFn,
  },
  {
    title: _("Delete"),
    "aria-label": _("Dummy delete action"),
    icon: <Icon name="delete" size="s" />,
    onClick: mockDeleteFn,
    isDanger: true,
  },
];

describe("RowActions", () => {
  it("allows interacting with given actions from a dropdown menu", async () => {
    const { user } = plainRender(
      <RowActions
        actions={actions}
        aria-label="Actions for testing"
        id="dummy-actions-for-testing"
      />,
    );

    const button = screen.getByRole("button", { name: "Actions for testing" });
    await user.click(button);
    screen.getByRole("menu");
    const editAction = screen.getByRole("menuitem", { name: "Dummy edit action" });
    await user.click(editAction);
    expect(mockEditFn).toHaveBeenCalled();
    await user.click(button);
    const deleteAction = screen.getByRole("menuitem", { name: "Dummy delete action" });
    await user.click(deleteAction);
    expect(mockDeleteFn).toHaveBeenCalled();
  });
});
