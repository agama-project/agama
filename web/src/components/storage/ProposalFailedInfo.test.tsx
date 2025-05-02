/*
 * Copyright (c) [2025] SUSE LLC
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
import { installerRender } from "~/test-utils";
import ProposalFailedInfo from "./ProposalFailedInfo";
import { LogicalVolume } from "~/types/storage/data";

const mockApiModel = jest.fn();

jest.mock("~/hooks/storage/api-model", () => ({
  ...jest.requireActual("~/hooks/storage/api-model"),
  useApiModel: () => mockApiModel,
}));

// eslint-disable-next-line
const fakeLogicalVolume: LogicalVolume = {
  // @ts-expect-error: The #name property is used to distinguish new "devices"
  // in the API model, but it is not yet exposed for logical volumes since they
  // are currently not reusable. This directive exists to ensure developers
  // don't overlook updating the ProposalFailedInfo component in the future,
  // when logical volumes become reusable and the #name property is exposed. See
  // the FIXME in the ProposalFailedInfo component for more context.
  name: "Reusable LV",
  lvName: "helpful",
};

describe("ProposalFailedInfo", () => {
  it("renders nothing if there are no config errors", () => {
    const { container } = installerRender(<ProposalFailedInfo />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing if there are no storage errors", () => {
    const { container } = installerRender(<ProposalFailedInfo />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("when there are neither, new partitions nor new logical volumes", () => {
    it.todo("renders a generic warning");
  });

  describe("when there are only new partitions", () => {
    it.todo("renders an specific warning refering to partitions");
  });

  describe("when there are only new logical volumes", () => {
    it.todo("renders specific warning refering to volumes");
  });

  describe("when there are both, new partitions and new logical volumes", () => {
    it.todo("renders more generic warning refering to file systems");
  });
});
