/*
 * Copyright (c) [2025] SUSE LLC
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
import { plainRender } from "~/test-utils";
import Details from "./Details";

describe("Details", () => {
  describe("basic rendering", () => {
    it("renders a PatternFly description list", () => {
      const { container } = plainRender(
        <Details>
          <Details.Item label="Name">John Doe</Details.Item>
        </Details>,
      );

      const descriptionList = container.querySelector("dl");
      expect(descriptionList).toBeInTheDocument();
      expect(descriptionList.classList).toContain("pf-v6-c-description-list");
    });

    it("renders multiple items", () => {
      plainRender(
        <Details>
          <Details.Item label="Name">John Doe</Details.Item>
          <Details.Item label="Email">john@example.com</Details.Item>
          <Details.Item label="Role">Developer</Details.Item>
        </Details>,
      );

      screen.getByText("Name");
      screen.getByText("John Doe");
      screen.getByText("Email");
      screen.getByText("john@example.com");
      screen.getByText("Role");
      screen.getByText("Developer");
    });

    it("renders with no items", () => {
      const { container } = plainRender(<Details />);

      const descriptionList = container.querySelector("dl");
      expect(descriptionList).toBeInTheDocument();
      expect(descriptionList).toBeEmptyDOMElement();
    });
  });

  describe("Details.Item", () => {
    it("renders label and children correctly", () => {
      plainRender(
        <Details>
          <Details.Item label="CPU">AMD Ryzen 7</Details.Item>
        </Details>,
      );

      screen.getByText("CPU");
      screen.getByText("AMD Ryzen 7");
    });

    describe("PatternFly props passthrough", () => {
      it("passes props to DescriptionList", () => {
        const { container } = plainRender(
          <Details isHorizontal isCompact>
            <Details.Item label="Name">John</Details.Item>
          </Details>,
        );

        const descriptionList = container.querySelector("dl");
        expect(descriptionList).toHaveClass("pf-m-horizontal");
        expect(descriptionList).toHaveClass("pf-m-compact");
      });
    });

    describe("termProps and descriptionProps", () => {
      it("passes termProps to DescriptionListTerm", () => {
        const { container } = plainRender(
          <Details>
            <Details.Item label="Name" termProps={{ className: "custom-term-class" }}>
              John
            </Details.Item>
          </Details>,
        );

        const term = container.querySelector("dt");
        expect(term).toHaveClass("custom-term-class");
      });

      it("passes descriptionProps to DescriptionListDescription", () => {
        const { container } = plainRender(
          <Details>
            <Details.Item label="Name" descriptionProps={{ className: "custom-desc-class" }}>
              John
            </Details.Item>
          </Details>,
        );

        const description = container.querySelector("dd");
        expect(description).toHaveClass("custom-desc-class");
      });
    });
  });

  describe("Details.StackItem", () => {
    it("renders given data within an opinionated flex layout", () => {
      const { container } = plainRender(
        <Details>
          <Details.StackItem
            label="Storage"
            content={<a href="#/storage">Use device vdd (20 GiB)</a>}
            description="Potential data loss"
          />
        </Details>,
      );

      const flexContainer = container.querySelector(
        '[class*="pf-v"][class*="-l-flex"][class*=pf-m-column]',
      );

      screen.getByText("Storage");
      screen.getByRole("link", { name: /Use device vdd/i });
      const small = container.querySelector("small");
      expect(small).toHaveTextContent("Potential data loss");
      expect(small).toHaveClass(/pf-v.-u-text-color-subtle/);
    });

    it("renders skeleton placeholders instead of content when isLoading is true", () => {
      const { container } = plainRender(
        <Details>
          <Details.StackItem
            label="Storage"
            content={<a href="#/storage">Use device vdd (20 GiB)</a>}
            description="Potential data loss"
            isLoading
          />
        </Details>,
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByText("Use device vdd (20 GiB)")).not.toBeInTheDocument();
      expect(screen.queryByText("Potential data loss")).not.toBeInTheDocument();
      const skeletons = container.querySelectorAll('[class*="pf-v"][class*="-c-skeleton"]');
      expect(skeletons.length).toBe(2);
    });
  });
});
