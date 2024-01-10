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
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation();
  });

  afterAll(() => {
    console.error.mockRestore();
  });

  describe("when title is given", () => {
    it("renders the section header", () => {
      plainRender(<Section title="Settings" />);
      screen.getByRole("heading", { name: "Settings" });
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
      const { container } = plainRender(<Section title="Settings" icon="not-valid-icon-name" />);
      const icon = container.querySelector("svg");
      expect(icon).toBeNull();
    });
  });

  describe("when title is not given", () => {
    it("does not render the section header", async () => {
      plainRender(<Section />);
      const header = await screen.queryByRole("heading");
      expect(header).not.toBeInTheDocument();
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
    screen.getByRole("heading", { name: "Settings", id: "settings-header-section" });
  });

  it("sets partially random header id if name is not given", () => {
    plainRender(<Section title="Settings" name="settings" />);
    screen.getByRole("heading", { name: "Settings", id: /.*(-header-section)$/ });
  });

  it("renders a polite live region", () => {
    plainRender(<Section title="Settings" />);

    const section = screen.getByRole("region", { name: "Settings" });
    expect(section).toHaveAttribute("aria-live", "polite");
  });

  it("renders given errors", () => {
    plainRender(
      <Section id="settings" title="Awesome settings" errors={[{ message: "Something went wrong" }]} />
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
