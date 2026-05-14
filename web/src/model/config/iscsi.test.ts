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

import iscsiModel from "~/model/config/iscsi";
import type { Target } from "~/model/config/iscsi";

const mockTarget: Target = {
  name: "iqn.2024-05.com.example:target1",
  address: "192.168.1.100",
  port: 3260,
  interface: "eth0",
  startup: "onboot",
};

describe("model/config/iscsi", () => {
  describe("#addTarget", () => {
    describe("when config targets are empty or undefined", () => {
      it("returns a config containing only the new target", () => {
        expect(iscsiModel.addTarget({}, mockTarget)).toEqual({ targets: [mockTarget] });
        expect(iscsiModel.addTarget({ targets: [] }, mockTarget)).toEqual({
          targets: [mockTarget],
        });
        expect(iscsiModel.addTarget({ targets: undefined }, mockTarget)).toEqual({
          targets: [mockTarget],
        });
      });
    });
  });

  describe("#removeTarget", () => {
    describe("when config targets are empty or undefined", () => {
      it("does not crash and returns a config with empty targets", () => {
        expect(
          iscsiModel.removeTarget({}, mockTarget.name, mockTarget.address, mockTarget.port),
        ).toEqual({ targets: [] });

        expect(
          iscsiModel.removeTarget(
            { targets: [] },
            mockTarget.name,
            mockTarget.address,
            mockTarget.port,
          ),
        ).toEqual({ targets: [] });

        expect(
          iscsiModel.removeTarget(
            { targets: undefined },
            mockTarget.name,
            mockTarget.address,
            mockTarget.port,
          ),
        ).toEqual({ targets: [] });
      });
    });
  });
});
