/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import type { Storage as System } from "~/model/system";
import ProposalHighlightedActions from "~/components/storage/ProposalHighlightedActions";

const mockManager = jest.fn();

jest.mock("~/components/storage/shared/use-devices-manager", () => ({
  useDevicesManager: () => mockManager(),
}));

const device = (klass: string) => ({ class: klass }) as System.Device;

const manager = ({
  deletedSystems = [],
  deletedDevices = [],
  resizedSystems = [],
  resizedDevices = [],
}: {
  deletedSystems?: string[];
  deletedDevices?: System.Device[];
  resizedSystems?: string[];
  resizedDevices?: System.Device[];
}) => ({
  deletedSystems: () => deletedSystems,
  deletedDevices: () => deletedDevices,
  resizedSystems: () => resizedSystems,
  resizedDevices: () => resizedDevices,
});

describe("ProposalHighlightedActions", () => {
  it("renders nothing when nothing is deleted or shrunk", () => {
    mockManager.mockReturnValue(manager({}));
    const { container } = plainRender(<ProposalHighlightedActions />);

    expect(container).toBeEmptyDOMElement();
  });

  it("counts the destructive actions", () => {
    mockManager.mockReturnValue(
      manager({ deletedDevices: [device("partition"), device("partition")] }),
    );
    plainRender(<ProposalHighlightedActions />);

    screen.getByText("Includes 2 destructive actions");
  });

  it("names the systems the destructive actions affect, once each", () => {
    mockManager.mockReturnValue(
      manager({
        deletedSystems: ["Windows", "Windows", "openSUSE"],
        deletedDevices: [device("partition"), device("partition")],
      }),
    );
    plainRender(<ProposalHighlightedActions />);

    screen.getByText(/Includes 2 destructive actions affecting at least Windows and openSUSE/);
  });

  it("prefers the destructive actions over the reductions", () => {
    mockManager.mockReturnValue(
      manager({ deletedDevices: [device("partition")], resizedDevices: [device("partition")] }),
    );
    plainRender(<ProposalHighlightedActions />);

    screen.getByText(/destructive action/);
    expect(screen.queryByText(/reduction/)).toBeNull();
  });

  it("names partitions when only partitions are shrunk", () => {
    mockManager.mockReturnValue(
      manager({ resizedSystems: ["Windows"], resizedDevices: [device("partition")] }),
    );
    plainRender(<ProposalHighlightedActions />);

    screen.getByText("Includes a non-destructive reduction of 1 partition affecting Windows.");
  });

  it("names logical volumes when only logical volumes are shrunk", () => {
    mockManager.mockReturnValue(
      manager({ resizedDevices: [device("logicalVolume"), device("logicalVolume")] }),
    );
    plainRender(<ProposalHighlightedActions />);

    screen.getByText(/2 logical volumes/);
    expect(screen.queryByText(/partition/)).toBeNull();
  });

  it("names both, and counts them together, when they are mixed", () => {
    mockManager.mockReturnValue(
      manager({ resizedDevices: [device("partition"), device("logicalVolume")] }),
    );
    plainRender(<ProposalHighlightedActions />);

    screen.getByText("Includes a non-destructive reduction of 2 partitions and logical volumes.");
  });
});
