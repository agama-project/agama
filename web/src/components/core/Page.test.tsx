/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { screen, waitFor, within } from "@testing-library/react";
import {
  installerRender,
  mockNavigateFn,
  mockProgresses,
  mockRoutes,
  plainRender,
} from "~/test-utils";
import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";
import { COMMON_PROPOSAL_KEYS } from "~/hooks/model/proposal";
import { PRODUCT, ROOT } from "~/routes/paths";
import { _ } from "~/i18n";
import Page from "./Page";

let consoleErrorSpy: jest.SpyInstance;
let mockStartTracking: jest.Mock = jest.fn();

jest.mock("~/hooks/use-track-queries-refetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlertMock</div>
));

const mockUseTrackQueriesRefetch = jest.mocked(useTrackQueriesRefetch);

describe("Page", () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error");
    consoleErrorSpy.mockImplementation();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
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

  describe("Page.Actions", () => {
    it("renders a footer sticky to bottom", () => {
      installerRender(
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
    it("triggers given onClick handler when user clicks on it, if valid", async () => {
      const onClick = jest.fn();
      const { user } = installerRender(<Page.Action onClick={onClick}>Cancel</Page.Action>);
      const button = screen.getByRole("button", { name: "Cancel" });
      await user.click(button);
      expect(onClick).toHaveBeenCalled();
    });

    it("navigates to the path given through 'navigateTo' prop when user clicks on it", async () => {
      const { user } = installerRender(<Page.Action navigateTo="/somewhere">Cancel</Page.Action>);
      const button = screen.getByRole("button", { name: "Cancel" });
      await user.click(button);
      expect(mockNavigateFn).toHaveBeenCalledWith("/somewhere");
    });
  });

  describe("Page.Content", () => {
    it("renders a node that fills all the available space", () => {
      installerRender(<Page.Content>{_("The Content")}</Page.Content>);
      const content = screen.getByText("The Content");
      expect(content.classList.contains("pf-m-fill")).toBe(true);
    });

    it("mounts a ProductRegistrationAlert", () => {
      installerRender(<Page.Content />);
      screen.getByText("ProductRegistrationAlertMock");
    });

    describe.each([
      ["login", ROOT.login],
      ["product selection", PRODUCT.changeProduct],
      ["product selection progress", PRODUCT.progress],
      ["installation progress", ROOT.installationProgress],
      ["installation finished", ROOT.installationFinished],
    ])(`but at %s path`, (_, path) => {
      beforeEach(() => {
        mockRoutes(path);
      });

      it("does not mount ProductRegistrationAlert", () => {
        installerRender(<Page.Content />);
        expect(screen.queryByText("ProductRegistrationAlertMock")).toBeNull();
      });
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

  describe("Page.Header", () => {
    it("renders a node that sticks to top", () => {
      const { container } = plainRender(<Page.Header>The Header</Page.Header>);
      expect(container.children[0].classList.contains("pf-m-sticky-top")).toBe(true);
    });
  });

  describe("Page.Section", () => {
    it("outputs to console.error if both are missing, title and aria-label", () => {
      plainRender(<Page.Section>Content</Page.Section>);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("must have either"));
    });

    it("renders a section node", () => {
      plainRender(<Page.Section aria-label="A Page Section">The Content</Page.Section>);
      const section = screen.getByRole("region");
      within(section).getByText("The Content");
    });

    it("adds the aria-labelledby attribute when title is given but aria-label is not", () => {
      const { rerender } = plainRender(
        <Page.Section title="A Page Section">The Content</Page.Section>,
      );
      const section = screen.getByRole("region");
      expect(section).toHaveAttribute("aria-labelledby");

      // aria-label is given through Page.Section props
      rerender(
        <Page.Section title="A Page Section" aria-label="An aria label">
          The Content
        </Page.Section>,
      );
      expect(section).not.toHaveAttribute("aria-labelledby");

      // aria-label is given through pfCardProps
      rerender(
        <Page.Section title="A Page Section" pfCardProps={{ "aria-label": "An aria label" }}>
          The Content
        </Page.Section>,
      );
      expect(section).not.toHaveAttribute("aria-labelledby");

      // None was given, title nor aria-label
      rerender(<Page.Section>The Content</Page.Section>);
      expect(section).not.toHaveAttribute("aria-labelledby");
    });

    it("renders given content props (title, description, actions, and children (content)", () => {
      installerRender(
        <Page.Section
          title="A section"
          description="Testing section with title, description, content, and actions"
          actions={<Page.Action>Disable</Page.Action>}
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

  describe("ProgressBackdrop", () => {
    describe("when no progress scope is provided", () => {
      it("does not render the backdrop", () => {
        installerRender(<Page>Content</Page>);
        expect(screen.queryByRole("alert")).toBeNull();
      });
    });

    describe("when progress scope is provided but no matching progress exists", () => {
      it("does not render the backdrop", () => {
        installerRender(<Page progressScope="software">Content</Page>);
        expect(screen.queryByRole("alert")).toBeNull();
      });
    });

    describe("when progress scope matches an active progress", () => {
      it("renders the backdrop with progress information", () => {
        mockProgresses([
          {
            scope: "software",
            step: "Installing packages",
            steps: [],
            index: 2,
            size: 5,
          },
        ]);
        installerRender(<Page progressScope="software">Content</Page>);
        const backdrop = screen.getByRole("alert", { name: /Installing packages/ });
        expect(backdrop.classList).toContain("agm-main-content-overlay");
        within(backdrop).getByText(/step 2 of 5/);
      });
    });

    describe("when progress finishes", () => {
      let mockStartTracking: jest.Mock;
      let mockCallback: (startedAt: number, completedAt: number) => void;

      beforeEach(() => {
        mockStartTracking = jest.fn();
        mockUseTrackQueriesRefetch.mockImplementation((keys, callback) => {
          mockCallback = callback;
          return { startTracking: mockStartTracking };
        });
      });

      // Test skipped because rerender fails when using installerRender,
      // caused by how InstallerProvider manages context.
      it.skip("shows 'Refreshing data...' message temporarily", async () => {
        // Start with active progress
        mockProgresses([
          {
            scope: "storage",
            step: "Calculating proposal",
            steps: ["Calculating proposal"],
            index: 1,
            size: 1,
          },
        ]);

        const { rerender } = installerRender(<Page progressScope="storage">Content</Page>);

        const backdrop = screen.getByRole("alert", { name: /Calculating proposal/ });

        // Progress finishes
        mockProgresses([]);

        rerender(<Page progressScope="storage">Content</Page>);

        // Should show "Refreshing data..." message
        await waitFor(() => {
          within(backdrop).getByText(/Refreshing data/);
        });

        // Should start tracking queries
        expect(mockStartTracking).toHaveBeenCalled();
      });

      // Test skipped because rerender fails when using installerRender,
      // caused by how InstallerProvider manages context.
      it.skip("hides backdrop after queries are refetched", async () => {
        // Start with active progress
        mockProgresses([
          {
            scope: "storage",
            step: "Calculating proposal",
            steps: ["Calculating proposal"],
            index: 1,
            size: 1,
          },
        ]);

        const { rerender } = installerRender(<Page progressScope="storage">Content</Page>);

        // Progress finishes
        mockProgresses([]);

        const backdrop = screen.getByRole("alert", { name: /Calculating proposal/ });

        rerender(<Page progressScope="storage">Content</Page>);

        // Should show refreshing message
        await waitFor(() => {
          within(backdrop).getByText(/Refreshing data/);
        });

        // Simulate queries completing by calling the callback
        const startedAt = Date.now();
        mockCallback(startedAt, startedAt + 100);

        // Backdrop should be hidden
        await waitFor(() => {
          expect(screen.queryByRole("alert")).toBeNull();
        });
      });
    });

    describe("when progress scope does not match", () => {
      it("does not show backdrop for different scope", () => {
        mockProgresses([
          {
            scope: "software",
            step: "Installing packages",
            steps: [],
            index: 2,
            size: 5,
          },
        ]);
        installerRender(<Page progressScope="storage">Content</Page>);
        expect(screen.queryByRole("alert", { name: /Installing packages/ })).toBeNull();
      });
    });

    describe("multiple progress updates", () => {
      it("updates the backdrop message when progress changes", () => {
        mockProgresses([
          {
            scope: "software",
            step: "Downloading packages",
            steps: [],
            index: 1,
            size: 5,
          },
        ]);
        const { rerender } = installerRender(<Page progressScope="software">Content</Page>);
        const backdrop = screen.getByRole("alert", { name: /Downloading packages/ });
        within(backdrop).getByText(/step 1 of 5/);

        mockProgresses([
          {
            scope: "software",
            step: "Installing packages",
            steps: [],
            index: 3,
            size: 5,
          },
        ]);
        rerender(<Page progressScope="software">Content</Page>);
        within(backdrop).getByText(/Installing packages/);
        within(backdrop).getByText(/step 3 of 5/);
      });
    });

    describe("additionalProgressKeys prop", () => {
      it("tracks common proposal keys by default", () => {
        mockProgresses([
          {
            scope: "software",
            step: "Installing packages",
            steps: [],
            index: 1,
            size: 3,
          },
        ]);

        installerRender(<Page progressScope="software">Content</Page>);

        // Should be called with COMMON_PROPOSAL_KEYS and undefined additionalKeys
        expect(mockUseTrackQueriesRefetch).toHaveBeenCalledWith(
          expect.arrayContaining(COMMON_PROPOSAL_KEYS),
          expect.any(Function),
        );
      });

      it("tracks additional query key along with common ones", () => {
        mockProgresses([
          {
            scope: "storage",
            step: "Calculating proposal",
            steps: [],
            index: 1,
            size: 1,
          },
        ]);

        installerRender(
          <Page progressScope="storage" additionalProgressKeys="storageModel">
            Content
          </Page>,
        );

        // Should be called with COMMON_PROPOSAL_KEYS + storageModel
        expect(mockUseTrackQueriesRefetch).toHaveBeenCalledWith(
          expect.arrayContaining([...COMMON_PROPOSAL_KEYS, "storageModel"]),
          expect.any(Function),
        );
      });

      it("tracks multiple additional query keys along with common ones", () => {
        mockProgresses([
          {
            scope: "network",
            step: "Configuring network",
            steps: [],
            index: 1,
            size: 2,
          },
        ]);

        installerRender(
          <Page progressScope="network" additionalProgressKeys={["networkConfig", "connections"]}>
            Content
          </Page>,
        );

        // Should be called with COMMON_PROPOSAL_KEYS + networkConfig + connections
        expect(mockUseTrackQueriesRefetch).toHaveBeenCalledWith(
          expect.arrayContaining([...COMMON_PROPOSAL_KEYS, "networkConfig", "connections"]),
          expect.any(Function),
        );
      });

      // Test skipped because rerender fails when using installerRender,
      // caused by how InstallerProvider manages context.
      it.skip("starts tracking when progress finishes", async () => {
        // Start with active progress
        mockProgresses([
          {
            scope: "storage",
            step: "Calculating proposal",
            steps: ["Calculating proposal"],
            index: 1,
            size: 1,
          },
        ]);

        const { rerender } = installerRender(
          <Page progressScope="storage" additionalProgressKeys="storageModel">
            Content
          </Page>,
        );

        // Progress finishes
        mockProgresses([]);

        rerender(
          <Page progressScope="storage" additionalProgressKeys="storageModel">
            Content
          </Page>,
        );
        rerender(
          <Page progressScope="storage" additionalProgressKeys="storageModel">
            Content
          </Page>,
        );

        // Should have called startTracking
        await waitFor(() => {
          expect(mockStartTracking).toHaveBeenCalled();
        });
      });
    });
  });
});
