/*
 * Copyright (c) [2026] SUSE LLC
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
import { Button } from "@patternfly/react-core";
import { plainRender } from "~/test-utils";
import SummaryLayout from "~/components/storage/storage-page/SummaryLayout";

describe("SummaryLayout", () => {
  it("opens with the sentence, as a second level heading", () => {
    plainRender(<SummaryLayout title="Use disk vdd as installation device" />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Use disk vdd as installation device" }),
    ).toBeInTheDocument();
  });

  it("renders nothing but the sentence when nothing else is given", () => {
    plainRender(<SummaryLayout title="Set up the new system across 3 disks" />);

    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the decision, the cost and the line about what follows", () => {
    plainRender(
      <SummaryLayout
        title="Set up the new system across 3 disks"
        control={<Button>Deleting everything</Button>}
        count={<span>View all 5 needed actions</span>}
        body="Review and configure the entries below."
      />,
    );

    expect(screen.getByRole("button", { name: "Deleting everything" })).toBeInTheDocument();
    expect(screen.getByText("View all 5 needed actions")).toBeInTheDocument();
    expect(screen.getByText("Review and configure the entries below.")).toBeInTheDocument();
  });

  describe("when there is a notice", () => {
    it("says what is wrong in place of what the plan costs", () => {
      plainRender(
        <SummaryLayout
          title="Use disk vdd as installation device"
          notice={<span>There is not enough room on vdd</span>}
          count={<span>View all 5 needed actions</span>}
        />,
      );

      screen.getByText("There is not enough room on vdd");
      expect(screen.queryByText("View all 5 needed actions")).not.toBeInTheDocument();
    });
  });

  describe("when there are actions", () => {
    it("closes the report with a rule and offers them after it", () => {
      plainRender(
        <SummaryLayout
          title="Use disk vdd as installation device"
          actions={<Button>Use another device</Button>}
        />,
      );

      expect(screen.getByRole("separator")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use another device" })).toBeInTheDocument();
    });
  });
});
