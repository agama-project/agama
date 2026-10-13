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

/** The facts sentence, which is there whenever the plan does anything. */
const facts = (count: number) =>
  count === 1
    ? "As a result, 1 action will be performed during installation to set up the final storage layout."
    : `As a result, ${count} actions will be performed during installation to set up the final storage layout.`;

/** What the line says beyond the facts sentence. */
const statement = (count: number) =>
  (document.body.textContent || "").replace(facts(count), "").trim();

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
      mockActions.mockReturnValue([{ device: 1, text: "" }]);
    });

    it("counts the actions as one sentence, with no control inside it", () => {
      installerRender(<Consequences />);

      screen.getByText(facts(1));
      expect(screen.queryByRole("link")).toBeNull();
    });

    it("states nothing else, since nothing on the machine is lost", () => {
      installerRender(<Consequences />);

      expect(statement(1)).toBe("");
    });
  });

  describe("when there is no proposal to read", () => {
    it("says nothing, leaving room for the page to say why", () => {
      installerRender(<Consequences />);

      expect(document.body.textContent).toBe("");
    });
  });

  describe("when a partition is made smaller", () => {
    describe("and the installer knows what is on it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1, [windows])]);
        mockActions.mockReturnValue([shrinking(1)]);
      });

      it("names it", () => {
        installerRender(<Consequences />);

        expect(statement(1)).toBe(
          "Includes a non-destructive reduction of 1 partition affecting Windows 11.",
        );
      });
    });

    describe("and the installer knows nothing about it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1), partition(2)]);
        mockActions.mockReturnValue([shrinking(1), shrinking(2)]);
      });

      it("counts what it cannot name", () => {
        installerRender(<Consequences />);

        expect(statement(2)).toBe("Includes a non-destructive reduction of 2 partitions.");
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
        installerRender(<Consequences />);

        expect(statement(1)).toBe("Includes 1 destructive action affecting Windows 11.");
      });
    });

    describe("and two systems go with it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1, [windows]), partition(2, [leap])]);
        mockActions.mockReturnValue([deleting(1), deleting(2)]);
      });

      it("names both", () => {
        installerRender(<Consequences />);

        expect(statement(2)).toBe(
          "Includes 2 destructive actions affecting Windows 11 and openSUSE Leap 15.2.",
        );
      });
    });

    describe("and three systems go with it", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([
          partition(1, [windows]),
          partition(2, [leap]),
          partition(3, [tumbleweed]),
        ]);
        mockActions.mockReturnValue([deleting(1), deleting(2), deleting(3)]);
      });

      it("names them all", () => {
        installerRender(<Consequences />);

        expect(statement(3)).toBe(
          "Includes 3 destructive actions affecting Windows 11, openSUSE Leap 15.2, and openSUSE Tumbleweed.",
        );
      });
    });

    describe("and something else is made smaller too", () => {
      beforeEach(() => {
        mockSystemDevices.mockReturnValue([partition(1, [windows]), partition(2, [leap])]);
        mockActions.mockReturnValue([deleting(1), shrinking(2)]);
      });

      it("reports only the deletion, which is the worse of the two", () => {
        installerRender(<Consequences />);

        expect(statement(2)).toBe("Includes 1 destructive action affecting Windows 11.");
      });
    });
  });

  describe("when the same system is found on several deleted partitions", () => {
    beforeEach(() => {
      mockSystemDevices.mockReturnValue([partition(1, [windows]), partition(2, [windows])]);
      mockActions.mockReturnValue([deleting(1), deleting(2)]);
    });

    it("names it once", () => {
      installerRender(<Consequences />);

      expect(statement(2)).toBe("Includes 2 destructive actions affecting Windows 11.");
    });
  });
});
