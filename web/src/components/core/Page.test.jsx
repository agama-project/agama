/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { installerRender, mockLayout } from "~/test-utils";
import { Page } from "~/components/core";

const mockNavigateFn = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigateFn,
}));
jest.mock("~/components/layout/Layout", () => mockLayout());

describe("Page", () => {
  it("renders given title", () => {
    installerRender(<Page title="The Title" />);
    screen.getByText("The Title");
  });

  it("renders an svg if icon is given", () => {
    const { container } = installerRender(<Page icon="info" />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).not.toBeNull();
  });

  it("does not render an svg if icon is not given", () => {
    const { container } = installerRender(<Page />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeNull();
  });

  describe("when action node is given", () => {
    it("renders the given action", () => {
      installerRender(<Page action={<span>Fake action</span>} />);
      screen.getByText("Fake action");
    });

    it("ignores action params", async () => {
      const callbackFn = jest.fn();
      const { user } = installerRender(
        <Page
          action={<span>Fake action</span>}
          actionCallback={callbackFn}
          actionLabel="Great action"
        />
      );
      const action = await screen.queryByText("Fake action");
      const defaultAction = await screen.queryByRole("button", { name: "Great action" });
      expect(defaultAction).toBeNull();
      await user.click(action);
      expect(callbackFn).not.toHaveBeenCalled();
    });
  });

  describe("when action node is not given", () => {
    describe("and none action param is given", () => {
      it("renders the 'default' action", () => {
        installerRender(<Page />);
        screen.getByRole("button", { name: "Accept" });
      });
    });

    describe("but action param are given", () => {
      it("does not render the 'default' action", async () => {
        installerRender(<Page actionLabel="Ok" actionVariant="plain" />);
        const defaultAction = await screen.queryByRole("button", { name: "Accept" });
        expect(defaultAction).toBeNull();
      });

      it("renders the action according to given params", async () => {
        installerRender(<Page actionLabel="Ok" actionVariant="plain" />);
        const defaultAction = await screen.findByRole("button", { name: "Ok" });
        expect(defaultAction.classList.contains("pf-m-plain")).toBe(true);
      });

      it("renders triggers given callback when user clicks the action", async () => {
        const callbackFn = jest.fn();
        const { user } = installerRender(<Page actionLabel="Ok" actionCallback={callbackFn} />);
        const defaultAction = await screen.findByRole("button", { name: "Ok" });
        await user.click(defaultAction);

        expect(callbackFn).toHaveBeenCalled();
      });
    });
  });
});
