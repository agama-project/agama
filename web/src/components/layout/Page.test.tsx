/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { Button } from "@patternfly/react-core";
import { installerRender, mockNavigateFn, plainRender } from "~/test-utils";
import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";
import { _ } from "~/i18n";
import Page from "./Page";

let consoleErrorSpy: jest.SpyInstance;
const mockStartTracking: jest.Mock = jest.fn();

jest.mock("~/hooks/use-track-queries-refetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("~/components/core/ProgressBackdrop", () => () => <div>ProgressBackdropMock</div>);

const mockUseTrackQueriesRefetch = jest.mocked(useTrackQueriesRefetch);

describe("Page", () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error");
    consoleErrorSpy.mockImplementation();
    // .scrollIntoView is not yet implemented at jsdom, https://github.com/jsdom/jsdom/issues/1695
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    HTMLElement.prototype.scrollIntoView = undefined;
  });

  beforeEach(() => {
    // Set up default mock for useTrackQueriesRefetch
    mockUseTrackQueriesRefetch.mockReturnValue({
      startTracking: mockStartTracking,
    });

    mockNavigateFn.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders given children", () => {
    installerRender(
      <Page>
        <h1>The Page Component</h1>
      </Page>,
    );
    screen.getByRole("heading", { name: "The Page Component" });
  });

  it("renders a single banner and a single main landmark", () => {
    installerRender(<Page title="Software">The Content</Page>);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("renders the given title as the top level heading", () => {
    installerRender(<Page title="Software">The Content</Page>);
    screen.getByRole("heading", { level: 1, name: "Software" });
  });

  it("moves the focus to the content when the user follows the skip link", async () => {
    const { user } = installerRender(<Page title="Software">The Content</Page>);
    await user.click(screen.getByRole("link", { name: "Skip to content" }));
    expect(document.activeElement).toContainElement(screen.getByText("The Content"));
  });

  describe("minimal variant", () => {
    it("renders the main landmark but no heading of its own", () => {
      installerRender(<Page variant="minimal">The Content</Page>);
      expect(screen.getAllByRole("main")).toHaveLength(1);
      expect(screen.queryByRole("heading")).toBeNull();
    });
  });

  describe("when no progress prop is provided", () => {
    it("does not mount ProgressBackdrop", () => {
      installerRender(<Page />);
      expect(screen.queryByText("ProgressBackdropMock")).toBeNull();
    });
  });

  describe("when progress prop is provided", () => {
    it("mounts ProgressBackdrop", () => {
      installerRender(<Page progress={{ scope: "software" }} />);
      screen.getByText("ProgressBackdropMock");
    });
  });

  describe("Page.Content", () => {
    it("renders a node that fills all the available space", () => {
      installerRender(<Page.Content>{_("The Content")}</Page.Content>);
      const content = screen.getByText("The Content");
      expect(content.classList.contains("pf-m-fill")).toBe(true);
    });
  });

  describe("Page.Cancel", () => {
    // Page.Cancel uses core/Link. It needs installerRender because of
    // useLocation usage
    it("renders a link that navigates to the top level route by default", () => {
      installerRender(<Page.Cancel />);
      const link = screen.getByRole("link", { name: "Cancel" });
      expect(link).toHaveAttribute("href", "..");
    });

    it("renders a link that navigates to the given route", () => {
      installerRender(<Page.Cancel navigateTo="somewhere" />);
      const link = screen.getByRole("link", { name: "Cancel" });
      expect(link).toHaveAttribute("href", "somewhere");
    });
  });

  describe("Page.Back", () => {
    it("renders a button for navigating back when user clicks on it", async () => {
      const { user } = installerRender(<Page.Back />);
      const button = screen.getByRole("button", { name: "Back" });
      await user.click(button);
      expect(mockNavigateFn).toHaveBeenCalledWith(-1);
    });

    it("uses `link` variant by default", () => {
      installerRender(<Page.Back />);
      const button = screen.getByRole("button", { name: "Back" });
      expect(button.classList.contains("pf-m-link")).toBe(true);
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

      const { user } = installerRender(
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

  describe("Page.Section", () => {
    it("renders a region named after the aria-label", () => {
      plainRender(<Page.Section aria-label={_("A Page Section")}>The Content</Page.Section>);
      const section = screen.getByRole("region", { name: "A Page Section" });
      within(section).getByText("The Content");
    });

    it("renders a region named after the title", () => {
      plainRender(<Page.Section title={_("A Page Section")}>The Content</Page.Section>);
      const section = screen.getByRole("region", { name: "A Page Section" });
      within(section).getByText("The Content");
    });

    it("renders the title as a second level heading by default", () => {
      plainRender(<Page.Section title={_("A Page Section")}>The Content</Page.Section>);
      screen.getByRole("heading", { level: 2, name: "A Page Section" });
    });

    it("renders no region when it has neither a title nor a label", () => {
      plainRender(<Page.Section>The Content</Page.Section>);
      screen.getByText("The Content");
      expect(screen.queryByRole("region")).toBeNull();
    });

    it("renders given content props (title, description, actions, and children (content)", () => {
      installerRender(
        <Page.Section
          title={_("A section")}
          description={_("Testing section with title, description, content, and actions")}
          actions={<Button>Disable</Button>}
        >
          The Content
        </Page.Section>,
      );
      const section = screen.getByRole("region");
      within(section).getByText("A section");
      within(section).getByText("Testing section with title, description, content, and actions");
      within(section).getByText("The Content");
      within(section).getByRole("button", { name: "Disable" });
    });
  });
});
