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
import { plainRender } from "~/test-utils";
import { IssuesAlert } from "~/components/core";
import { Issue, IssueSeverity, IssueSource } from "~/types/issues";
import { SOFTWARE } from "~/routes/paths";

describe("IssueAlert", () => {
  it("renders a list of issues", () => {
    const issue: Issue = {
      description: "A generic issue",
      source: IssueSource.Config,
      severity: IssueSeverity.Error,
      kind: "generic",
      scope: "software",
    };
    plainRender(<IssuesAlert issues={[issue]} />);
    expect(screen.getByText(issue.description)).toBeInTheDocument();
  });

  it("renders a link to conflict resolution when there is a 'solver' issue", () => {
    const issue: Issue = {
      description: "Conflicts found",
      source: IssueSource.Config,
      severity: IssueSeverity.Error,
      kind: "solver",
      scope: "software",
    };
    plainRender(<IssuesAlert issues={[issue]} />);
    const link = screen.getByRole("link", { name: "Review and fix" });
    expect(link).toHaveAttribute("href", SOFTWARE.conflicts);
  });
});
