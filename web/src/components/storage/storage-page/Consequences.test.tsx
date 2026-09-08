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
import { plainRender } from "~/test-utils";
import type { Storage as System } from "~/model/system";
import type { Storage as Proposal } from "~/model/proposal";
import Consequences from "~/components/storage/storage-page/Consequences";

const mockSystemDevices = jest.fn();
const mockActions = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => mockSystemDevices(),
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useFlattenDevices: () => [],
  useActions: () => mockActions(),
}));

/** A partition the machine already has, with whatever was found on it. */
const partition = (sid: number, systems: string[] = []): System.Device => ({
  sid,
  name: `/dev/vda${sid}`,
  class: "partition",
  block: { systems } as System.Device["block"],
});

const deleting = (sid: number): Proposal.Action => ({ device: sid, text: "", delete: true });
const shrinking = (sid: number): Proposal.Action => ({ device: sid, text: "", resize: true });

/** Everything the line renders, as the reader hears it. */
const statement = () => document.body.textContent;

const windows = "Windows 11";
const leap = "openSUSE Leap 15.2";
const tumbleweed = "openSUSE Tumbleweed";

describe("Consequences", () => {
  beforeEach(() => {
    mockSystemDevices.mockReturnValue([]);
    mockActions.mockReturnValue([]);
  });

  describe("when nothing is deleted or made smaller", () => {
    beforeEach(() => {
      mockSystemDevices.mockReturnValue([partition(1, [windows])]);
    });

    it("says nothing, since there is nothing to warn about", () => {
      plainRender(<Consequences />);

      expect(statement()).toBe("");
    });
  });

  describe("when there is no proposal to read", () => {
    it("says nothing, leaving room for the page to say why", () => {
      plainRender(<Consequences />);

      expect(statement()).toBe("");
    });
  });

  describe("when a partition is made smaller", () => {
    describe("and the installer knows what is on it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1, [windows])]);
        mockActions.mockReturnValue([shrinking(1)]);
      });

      it("names it", () => {
        plainRender(<Consequences />);

        expect(statement()).toBe("Shrinking Windows 11.");
      });
    });

    describe("and the installer knows nothing about it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1), partition(2)]);
        mockActions.mockReturnValue([shrinking(1), shrinking(2)]);
      });

      it("counts what it cannot name", () => {
        plainRender(<Consequences />);

        expect(statement()).toBe("Shrinking 2 partitions.");
      });
    });
  });

  describe("when a partition is deleted", () => {
    describe("and one system goes with it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1, [windows])]);
        mockActions.mockReturnValue([deleting(1)]);
      });

      it("names it", () => {
        plainRender(<Consequences />);

        expect(statement()).toBe("Deleting Windows 11.");
      });
    });

    describe("and two systems go with it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1, [windows]), partition(2, [leap])]);
        mockActions.mockReturnValue([deleting(1), deleting(2)]);
      });

      it("names both", () => {
        plainRender(<Consequences />);

        expect(statement()).toBe("Deleting Windows 11 and openSUSE Leap 15.2.");
      });
    });

    describe("and three or more systems go with it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([
          partition(1, [windows]),
          partition(2, [leap]),
          partition(3, [tumbleweed]),
        ]);
        mockActions.mockReturnValue([deleting(1), deleting(2), deleting(3)]);
      });

      it("names one and counts the rest, so the reader still recognizes something", () => {
        plainRender(<Consequences />);

        expect(statement()).toBe("Deleting Windows 11 and 2 other systems.");
      });
    });

    describe("and the installer knows nothing about what is on it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1), partition(2)]);
        mockActions.mockReturnValue([deleting(1), deleting(2)]);
      });

      it("counts what it cannot name", () => {
        plainRender(<Consequences />);

        expect(statement()).toBe("Deleting 2 partitions.");
      });
    });

    describe("and something else is made smaller too", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1, [windows]), partition(2, [leap])]);
        mockActions.mockReturnValue([deleting(1), shrinking(2)]);
      });

      it("reports only the deletion, which is the worse of the two", () => {
        plainRender(<Consequences />);

        expect(statement()).toBe("Deleting Windows 11.");
      });
    });
  });

  describe("when the same system is found on several deleted partitions", () => {
    beforeEach(() => {
      mockSystemDevices.mockReturnValue([partition(1, [windows]), partition(2, [windows])]);
      mockActions.mockReturnValue([deleting(1), deleting(2)]);
    });

    it("names it once", () => {
      plainRender(<Consequences />);

      expect(statement()).toBe("Deleting Windows 11.");
    });
  });
});
