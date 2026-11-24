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
import { installerRender } from "~/test-utils";
import type { Entry } from "~/components/storage/device-details/entry";
import PlannedActions from "~/components/storage/device-details/PlannedActions";

jest.mock("~/components/storage/device-details/MoveToOtherDevice", () => () => (
  <button type="button">Move to other device</button>
));

const disk = (partitions = []): Entry => ({
  config: { name: "/dev/vda", partitions },
  device: null,
  name: "/dev/vda",
  isVolumeGroup: false,
});

const subject = { collection: "drives" as const, index: 0 };

describe("PlannedActions", () => {
  it("shows the extra actions it is given after the one for adding", () => {
    installerRender(
      <PlannedActions entry={disk()} subject={subject} extraActions={<a href="#more">More</a>} />,
    );

    const add = screen.getByRole("link", { name: "Add partition" });
    const more = screen.getByRole("link", { name: "More" });
    expect(add.compareDocumentPosition(more)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("offers moving the plan only when there is something planned", () => {
    const { rerender } = installerRender(<PlannedActions entry={disk()} subject={subject} />);
    expect(screen.queryByRole("button", { name: "Move to other device" })).toBeNull();

    rerender(<PlannedActions entry={disk([{ mountPath: "/home" }])} subject={subject} />);
    screen.getByRole("button", { name: "Move to other device" });
  });
});
