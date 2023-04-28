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
import { screen, waitFor } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { NotificationMark } from "~/components/core";
import { createClient } from "~/client";

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

describe("if there are issues", () => {
  beforeEach(() => {
    hasIssues = true;
  });

  it("renders a span with status role", async () => {
    installerRender(<NotificationMark aria-label="See issues" />, { usingProvider: true });
    await screen.findByRole("status", { name: "See issues" });
  });
});

describe("if there are not issues", () => {
  beforeEach(() => {
    hasIssues = false;
  });

  it("renders nothing", async () => {
    installerRender(<NotificationMark aria-label="See issues" />, { usingProvider: true });
    waitFor(async () => {
      const mark = await screen.findByRole("status", { name: "See issues" });
      expect(mark).toBeNull();
    });
  });
});
