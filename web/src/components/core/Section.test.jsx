/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { plainRender, installerRender } from "~/test-utils";
import { Section } from "~/components/core";

describe("Section", () => {
  it("renders given title", () => {
    plainRender(<Section title="settings" />);

    screen.getByRole("heading", { name: "settings" });
  });

  it("renders given errors", () => {
    plainRender(
      <Section title="Awesome settings" errors={[{ message: "Something went wrong" }]} />
    );

    screen.getByText("Something went wrong");
  });

  it("renders given content", () => {
    plainRender(
      <Section title="Settings">
        A settings summary
      </Section>
    );

    screen.getByText("A settings summary");
  });

  it("renders an icon when set as loading", () => {
    // TODO: add a mechanism to check that it's the expected icon. data-something attribute?
    const { container } = plainRender(<Section title="Settings" loading />);
    container.querySelector("svg");
  });

  it("renders an icon when a valid icon name is given", () => {
    // TODO: add a mechanism to check that it's the expected icon. data-something attribute?
    const { container } = plainRender(<Section title="Settings" icon="settings" />);
    container.querySelector("svg");
  });

  it("does not render an icon when either, not loading or not icon name was given", () => {
    // TODO: add a mechanism to check that it's the expected icon. data-something attribute?
    const { container } = plainRender(<Section title="Settings" />);
    const icon = container.querySelector("svg");
    expect(icon).toBeNull();
  });

  describe("when path is given", () => {
    it("renders a link for navigating to it", async () => {
      installerRender(<Section title="Settings" path="/settings" />);
      const heading = screen.getByRole("heading", { name: "Settings" });
      const link = within(heading).getByRole("link", { name: "Settings" });
      expect(link).toHaveAttribute("href", "/settings");
    });
  });

  describe("when openDialog callback is given", () => {
    describe("and path is not present", () => {
      it("triggers it when the user click on the section title", async () => {
        const openDialog = jest.fn();
        const { user } = installerRender(
          <Section title="Settings" openDialog={openDialog} />
        );
        const button = screen.getByRole("button", { name: "Settings" });
        await user.click(button);
        expect(openDialog).toHaveBeenCalled();
      });
    });

    describe("but path is present too", () => {
      it("does not triggers it when the user click on the section title", async () => {
        const openDialog = jest.fn();
        const { user } = installerRender(
          <Section path="/settings" title="Settings" openDialog={openDialog} />
        );
        const link = screen.getByRole("link", { name: "Settings" });
        await user.click(link);
        expect(openDialog).not.toHaveBeenCalled();
      });
    });
  });
});
