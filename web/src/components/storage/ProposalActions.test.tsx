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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProposalActions from "./ProposalActions";
import type { Storage as Proposal } from "~/model/proposal";

const generalAction1: Proposal.Action = { device: 1, text: "format /dev/sda1" };
const generalAction2: Proposal.Action = {
  device: 2,
  text: "delete /dev/sdb",
  delete: true,
};
const subvolAction1: Proposal.Action = {
  device: 1,
  text: "create subvolume @/home",
  subvol: true,
};
const subvolAction2: Proposal.Action = {
  device: 1,
  text: "delete subvolume @/var",
  subvol: true,
  delete: true,
};
const multilineAction: Proposal.Action = {
  device: 1,
  text: "first line\nsecond line",
};

describe("ProposalActions", () => {
  it("renders nothing when there are no actions", () => {
    const { container } = render(<ProposalActions actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only general actions", () => {
    render(<ProposalActions actions={[generalAction1, generalAction2]} />);
    expect(screen.getByText(generalAction1.text)).toBeInTheDocument();
    expect(screen.getByText(generalAction2.text)).toBeInTheDocument();
    expect(screen.getByText(generalAction2.text).tagName).toBe("STRONG");
  });

  it("renders multiline actions", () => {
    render(<ProposalActions actions={[multilineAction]} />);
    expect(screen.getByText("first line")).toBeInTheDocument();
    expect(screen.getByText("second line")).toBeInTheDocument();
  });

  describe("when there are subvolume actions", () => {
    it("renders them in a collapsed expandable section", () => {
      render(<ProposalActions actions={[subvolAction1, subvolAction2]} />);
      expect(screen.getByText(/Show 2 subvolume actions/)).toBeInTheDocument();
      expect(screen.queryByText(subvolAction1.text)).not.toBeVisible();
      expect(screen.queryByText(subvolAction2.text)).not.toBeVisible();
    });

    it("expands and collapses the section", async () => {
      const user = userEvent.setup();
      render(<ProposalActions actions={[generalAction1, subvolAction1, subvolAction2]} />);

      // General action should be visible
      expect(screen.getByText(generalAction1.text)).toBeInTheDocument();

      const toggle = screen.getByText(/Show 2 subvolume actions/);
      await user.click(toggle);

      expect(screen.getByText(/Hide 2 subvolume actions/)).toBeInTheDocument();
      expect(screen.getByText(subvolAction1.text)).toBeVisible();
      expect(screen.getByText(subvolAction2.text)).toBeVisible();
      expect(screen.getByText(subvolAction2.text).tagName).toBe("STRONG");

      await user.click(toggle);

      expect(screen.getByText(/Show 2 subvolume actions/)).toBeInTheDocument();
      expect(screen.queryByText(subvolAction1.text)).not.toBeVisible();
      expect(screen.queryByText(subvolAction2.text)).not.toBeVisible();
    });
  });
});
