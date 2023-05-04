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
import { screen, within } from "@testing-library/react";
import { installerRender, withNotificationProvider } from "~/test-utils";
import { createClient } from "~/client";
import { IssuesLink } from "~/components/core";

let hasIssues = false;

jest.mock("~/client");

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      issues: {
        any: () => Promise.resolve(hasIssues),
        onIssuesChange: jest.fn()
      }
    };
  });
});

it("renders a link for navigating to the issues page", async () => {
  installerRender(withNotificationProvider(<IssuesLink />));
  const link = await screen.findByRole("link", { name: "Show issues" });
  expect(link).toHaveAttribute("href", "/issues");
});

describe("if there are issues", () => {
  beforeEach(() => {
    hasIssues = true;
  });

  it("includes a notification mark", async () => {
    installerRender(withNotificationProvider(<IssuesLink />));
    const link = await screen.findByRole("link", { name: /new issues/ });
    within(link).getByRole("status", { name: /new issues/ });
  });
});

describe("if there are not issues", () => {
  beforeEach(() => {
    hasIssues = false;
  });

  it("does not include a notification mark", async () => {
    installerRender(withNotificationProvider(<IssuesLink />));
    const link = await screen.findByRole("link", { name: "Show issues" });
    const mark = within(link).queryByRole("status", { name: /new issues/ });
    expect(mark).toBeNull();
  });
});
