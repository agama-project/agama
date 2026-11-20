/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { IssuesAlert } from "~/components/core";
import type { Issue } from "~/model/issue";

const genericIssue: Issue = {
  description: "A generic issue",
  class: "generic",
  scope: "software",
};

const issueWithDetails: Issue = {
  description: "An issue with details",
  class: "loadSource",
  scope: "software",
  details: "Failed to download https://download.opensuse.org/repo/oss/",
};

const anotherIssue: Issue = {
  description: "Another issue",
  class: "generic",
  scope: "software",
};

describe("IssuesAlert", () => {
  it("renders nothing when there are no issues", () => {
    const { container } = installerRender(<IssuesAlert issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("when there is a single issue", () => {
    it("renders the issue description as the alert title", () => {
      installerRender(<IssuesAlert issues={[genericIssue]} />);
      screen.getByRole("heading", { name: /A generic issue/ });
    });

    it("does not render a list", () => {
      installerRender(<IssuesAlert issues={[genericIssue]} />);
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("does not render technical details section when details are absent", () => {
      installerRender(<IssuesAlert issues={[genericIssue]} />);
      expect(screen.queryByText("Show technical details")).not.toBeInTheDocument();
    });

    it("renders technical details expandable section when details are present", async () => {
      const { user } = installerRender(<IssuesAlert issues={[issueWithDetails]} />);
      const toggle = screen.getByText("Show technical details");
      await user.click(toggle);
      screen.getByText(/Failed to download https:\/\/download\.opensuse\.org/);
    });
  });

  describe("when there are multiple issues", () => {
    it("renders a generic alert title and a list of issue descriptions", () => {
      installerRender(<IssuesAlert issues={[genericIssue, anotherIssue]} />);
      screen.getByRole("heading", { name: /You must fix these issues/ });
      screen.getByText(genericIssue.description);
      screen.getByText(anotherIssue.description);
    });

    it("renders technical details for issues that have them", async () => {
      const { user } = installerRender(<IssuesAlert issues={[genericIssue, issueWithDetails]} />);
      const toggle = screen.getByText("Show technical details");
      await user.click(toggle);
      screen.getByText(/Failed to download https:\/\/download\.opensuse\.org/);
    });
  });
});
