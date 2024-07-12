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

// @ts-check

import React from "react";
import { screen, within } from "@testing-library/react";
import { plainRender, installerRender } from "~/test-utils";
import { Section } from "~/components/core";

let consoleErrorSpy;

describe.skip("Section", () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error");
    consoleErrorSpy.mockImplementation();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("when title is given", () => {
    it("renders the section header", () => {
      plainRender(<Section title="Settings" />);
      screen.getByRole("banner");
    });

    it("renders given title as section heading", () => {
      plainRender(<Section title="Settings" />);
      const header = screen.getByRole("banner");
      within(header).getByRole("heading", { name: "Settings" });
    });

    it("renders an icon if valid icon name is given", () => {
      const { container } = plainRender(<Section title="Settings" icon="settings" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("data-icon-name", "settings");
    });

    it("does not render an icon if icon name not given", () => {
      const { container } = plainRender(<Section title="Settings" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeNull();
      // Check that <Icon /> component was not mounted with 'undefined'
      expect(console.error).not.toHaveBeenCalled();
    });

    it("does not render an icon if not valid icon name is given", () => {
      // @ts-expect-error: Creating the icon name dynamically is unlikely, but let's be safe.
      const { container } = plainRender(
        <Section title="Settings" icon={`fake-${Date.now()}-icon`} />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeNull();
    });

    it("renders given description as part of the header", () => {
      plainRender(
        <Section title="Settings" description="Short explanation to help the user, if needed" />,
      );
      const header = screen.getByRole("banner");
      within(header).getByText(/Short explanation/);
    });
  });

  describe("when title is not given", () => {
    it("does not render the section header", async () => {
      plainRender(<Section description="Does not matter" />);
      const header = await screen.queryByRole("banner");
      expect(header).not.toBeInTheDocument();
    });

    it("does not render a section heading", async () => {
      plainRender(<Section description="Does not matter" />);
      const heading = await screen.queryByRole("heading");
      expect(heading).not.toBeInTheDocument();
    });

    it("does not render the section icon", () => {
      const { container } = plainRender(<Section icon="settings" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeNull();
    });
  });

  describe("when aria-label is given", () => {
    it("sets aria-label attribute", () => {
      plainRender(<Section title="Settings" aria-label="User settings" />);
      const section = screen.getByRole("region", { name: "User settings" });
      expect(section).toHaveAttribute("aria-label", "User settings");
    });

    it("does not set aria-labelledby", () => {
      plainRender(<Section title="Settings" aria-label="User settings" />);
      const section = screen.getByRole("region", { name: "User settings" });
      expect(section).not.toHaveAttribute("aria-labelledby");
    });
  });

  describe("when aria-label is not given", () => {
    it("sets aria-labelledby if title is provided", () => {
      plainRender(<Section title="Settings" />);
      const section = screen.getByRole("region", { name: "Settings" });
      expect(section).toHaveAttribute("aria-labelledby");
    });

    it("does not set aria-label", () => {
      plainRender(<Section title="Settings" />);
      const section = screen.getByRole("region", { name: "Settings" });
      expect(section).not.toHaveAttribute("aria-label");
    });
  });

  it("sets predictable header id if name is given", () => {
    plainRender(<Section title="Settings" name="settings" />);
    const section = screen.getByRole("heading", { name: "Settings" });
    expect(section).toHaveAttribute("id", "settings-section-header");
  });

  it("sets partially random header id if name is not given", () => {
    plainRender(<Section title="Settings" />);
    const section = screen.getByRole("heading", { name: "Settings" });
    expect(section).toHaveAttribute("id", expect.stringContaining("section-header"));
  });

  it("renders a polite live region", () => {
    plainRender(<Section title="Settings" />);

    const section = screen.getByRole("region", { name: "Settings" });
    expect(section).toHaveAttribute("aria-live", "polite");
  });

  it("renders given errors", () => {
    plainRender(
      <Section
        id="settings"
        title="Awesome settings"
        errors={[{ message: "Something went wrong" }]}
      />,
    );

    screen.getByText("Something went wrong");
  });

  it("renders given content", () => {
    plainRender(<Section title="Settings">A settings summary</Section>);

    screen.getByText("A settings summary");
  });

  it("does not set aria-busy", () => {
    plainRender(<Section title="Settings" />);

    screen.getByRole("region", { name: "Settings", busy: false });
  });

  describe("when set as loading", () => {
    it("sets aria-busy", () => {
      plainRender(<Section title="Settings" loading />);

      screen.getByRole("region", { busy: true });
    });

    it("renders the loading icon if title was given", () => {
      const { container } = plainRender(<Section title="Settings" loading />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("data-icon-name", "loading");
    });

    it("does not render the loading icon if title was not given", () => {
      const { container } = plainRender(<Section loading />);
      const icon = container.querySelector("svg");
      expect(icon).toBeNull();
    });
  });

  describe("when path is given", () => {
    it("renders a link for navigating to it", async () => {
      installerRender(<Section title="Settings" path="/settings" />);
      const heading = screen.getByRole("heading", { name: "Settings" });
      const link = within(heading).getByRole("link", { name: "Settings" });
      expect(link).toHaveAttribute("href", "/settings");
    });
  });
});
