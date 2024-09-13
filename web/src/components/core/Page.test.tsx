/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { plainRender, mockNavigateFn } from "~/test-utils";
import { Page } from "~/components/core";
import { _ } from "~/i18n";

let consoleErrorSpy: jest.SpyInstance;

describe("Page", () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error");
    consoleErrorSpy.mockImplementation();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders given children", () => {
    plainRender(
      <Page>
        <h1>{_("The Page Component")}</h1>
      </Page>,
    );
    screen.getByRole("heading", { name: "The Page Component" });
  });

  describe("Page.Actions", () => {
    it("renders a footer sticky to bottom", () => {
      plainRender(
        <Page.Actions>
          <Page.Action>Save</Page.Action>
          <Page.Action>Discard</Page.Action>
        </Page.Actions>,
      );

      const footer = screen.getByRole("contentinfo");
      expect(footer.classList.contains("pf-m-sticky-bottom")).toBe(true);
    });
  });

  describe("Page.Action", () => {
    it("renders a button with given content", () => {
      plainRender(<Page.Action>Save</Page.Action>);
      screen.getByRole("button", { name: "Save" });
    });

    it("renders an 'lg' button when size prop is not given", () => {
      plainRender(<Page.Action>Cancel</Page.Action>);
      const button = screen.getByRole("button", { name: "Cancel" });
      expect(button.classList.contains("pf-m-display-lg")).toBe(true);
    });

    describe("when user clicks on it", () => {
      it("triggers given onClick handler, if valid", async () => {
        const onClick = jest.fn();
        const { user } = plainRender(<Page.Action onClick={onClick}>Cancel</Page.Action>);
        const button = screen.getByRole("button", { name: "Cancel" });
        await user.click(button);
        expect(onClick).toHaveBeenCalled();
      });

      it("navigates to the path given through 'navigateTo' prop", async () => {
        const { user } = plainRender(<Page.Action navigateTo="/somewhere">Cancel</Page.Action>);
        const button = screen.getByRole("button", { name: "Cancel" });
        await user.click(button);
        expect(mockNavigateFn).toHaveBeenCalledWith("/somewhere");
      });
    });
  });

  describe("Page.Content", () => {
    it("renders a node that fills all the available space", () => {
      plainRender(<Page.Content>{_("The Content")}</Page.Content>);
      const content = screen.getByText("The Content");
      expect(content.classList.contains("pf-m-fill")).toBe(true);
    });
  });

  describe("Page.Cancel", () => {
    it("renders a 'Cancel' button that navigates to the top level route by default", async () => {
      const { user } = plainRender(<Page.Cancel />);
      const button = screen.getByRole("button", { name: "Cancel" });
      await user.click(button);
      expect(mockNavigateFn).toHaveBeenCalledWith("..");
    });
  });

  describe("Page.Back", () => {
    it("renders a button for navigating back when user clicks on it", async () => {
      const { user } = plainRender(<Page.Back />);
      const button = screen.getByRole("button", { name: "Back" });
      await user.click(button);
      expect(mockNavigateFn).toHaveBeenCalledWith(-1);
    });

    it("uses `lg` size and `link` variant by default", () => {
      plainRender(<Page.Back />);
      const button = screen.getByRole("button", { name: "Back" });
      expect(button.classList.contains("pf-m-link")).toBe(true);
      expect(button.classList.contains("pf-m-display-lg")).toBe(true);
    });
  });

  describe("Page.Submit", () => {
    it("triggers both, form submission of its associated form and onClick handler if given", async () => {
      const onClick = jest.fn();
      // NOTE: using preventDefault here to avoid a jsdom error
      // Error: Not implemented: HTMLFormElement.prototype.requestSubmit
      const onSubmit = jest.fn((e) => {
        e.preventDefault();
      });

      const { user } = plainRender(
        <>
          <form onSubmit={onSubmit} id="fake-form" />
          <Page.Submit form="fake-form" onClick={onClick}>
            Send
          </Page.Submit>
        </>,
      );
      const button = screen.getByRole("button", { name: "Send" });
      await user.click(button);
      expect(onSubmit).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalled();
    });
  });
  describe("Page.Header", () => {
    it("renders a node that sticks to top", () => {
      plainRender(<Page.Header>{_("The Header")}</Page.Header>);
      const content = screen.getByText("The Header");
      const container = content.parentNode as HTMLElement;
      expect(container.classList.contains("pf-m-sticky-top")).toBe(true);
    });
  });

  describe("Page.Section", () => {
    it("outputs to console.error if both are missing, title and aria-label", () => {
      plainRender(<Page.Section>{_("Content")}</Page.Section>);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("must have either"));
    });

    it("renders a section node", () => {
      plainRender(<Page.Section aria-label="A Page Section">{_("The Content")}</Page.Section>);
      const section = screen.getByRole("region");
      within(section).getByText("The Content");
    });

    it("adds the aria-labelledby attribute when title is given but aria-label is not", () => {
      const { rerender } = plainRender(
        <Page.Section title="A Page Section">{_("The Content")}</Page.Section>,
      );
      const section = screen.getByRole("region");
      expect(section).toHaveAttribute("aria-labelledby");

      // aria-label is given through Page.Section props
      rerender(
        <Page.Section title="A Page Section" aria-label="An aria label">
          {_("The Content")}
        </Page.Section>,
      );
      expect(section).not.toHaveAttribute("aria-labelledby");

      // aria-label is given through pfCardProps
      rerender(
        <Page.Section title="A Page Section" pfCardProps={{ "aria-label": "An aria label" }}>
          {_("The Content")}
        </Page.Section>,
      );
      expect(section).not.toHaveAttribute("aria-labelledby");

      // None was given, title nor aria-label
      rerender(<Page.Section>{_("The Content")}</Page.Section>);
      expect(section).not.toHaveAttribute("aria-labelledby");
    });

    it("renders given content props (title, value, description, actions, and children (content)", () => {
      plainRender(
        <Page.Section
          title={_("A section")}
          value={"Enabled"}
          description={_("Testing section with title, value, description, content, and actions")}
          actions={<Page.Action>{_("Disable")}</Page.Action>}
        >
          {_("The Content")}
        </Page.Section>,
      );
      const section = screen.getByRole("region");
      within(section).getByText("A section");
      within(section).getByText("Enabled");
      within(section).getByText(
        "Testing section with title, value, description, content, and actions",
      );
      within(section).getByText("The Content");
      within(section).getByRole("button", { name: "Disable" });
    });
  });
});
