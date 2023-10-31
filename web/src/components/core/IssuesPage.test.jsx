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
import { IssuesPage } from "~/components/core";

jest.mock("~/client");

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <div>PFSkeleton</div>
  };
});

let issues = {
  storage: [
    { description: "Issue 1", details: "Details 1", source: "system", severity: "warn" },
    { description: "Issue 2", details: "Details 2", source: "config", severity: "error" }
  ]
};

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      issues: {
        any: () => Promise.resolve(true),
        getAll: () => Promise.resolve(issues),
        onIssuesChange: jest.fn()
      }
    };
  });
});

it("loads the issues", async () => {
  installerRender(withNotificationProvider(<IssuesPage />));

  screen.getAllByText(/PFSkeleton/);
  await screen.findByText(/Issue 1/);
});

it("renders sections with issues", async () => {
  installerRender(withNotificationProvider(<IssuesPage />));

  const section = await screen.findByRole("region", { name: "Storage" });
  within(section).findByText(/Issue 1/);
  within(section).findByText(/Issue 2/);
});

describe("if there are not issues", () => {
  beforeEach(() => {
    issues = { storage: [] };
  });

  it("renders a success message", async () => {
    installerRender(withNotificationProvider(<IssuesPage />));

    await screen.findByText(/No issues found/);
  });
});
