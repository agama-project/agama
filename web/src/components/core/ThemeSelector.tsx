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

import React, { useState } from "react";
import {
  Content,
  Dropdown,
  MenuToggle,
  MenuToggleElement,
  Stack,
  StackItem,
  ToggleGroup,
  ToggleGroupItem,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { useTheme } from "~/context/theme";
import { _ } from "~/i18n";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

/**
 * Lets the user pick the interface theme along two independent axes: the color
 * scheme (System/Light/Dark) and the contrast level (Standard/High).
 *
 * Rendered as an icon toggle that opens a small panel with a button group per
 * axis, mirroring PatternFly's own theme selector. The selection is applied to
 * the document root and persisted by {@link useTheme}.
 */
export default function ThemeSelector(): React.ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const { colorScheme, setColorScheme, contrast, setContrast } = useTheme();

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      popperProps={{ position: "right", appendTo: () => document.body }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          aria-label={_("Theme")}
          variant="plain"
          isFullHeight
          isExpanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Icon name="routine" />
        </MenuToggle>
      )}
    >
      <Stack hasGutter className={spacingStyles.pMd}>
        <StackItem>
          <Content component="small">{_("Color scheme")}</Content>
          <ToggleGroup aria-label={_("Color scheme")}>
            <ToggleGroupItem
              // TRANSLATORS: color scheme option that follows the operating system setting
              text={_("System")}
              isSelected={colorScheme === "system"}
              onChange={() => setColorScheme("system")}
            />
            <ToggleGroupItem
              // TRANSLATORS: bright color scheme option
              text={_("Light")}
              isSelected={colorScheme === "light"}
              onChange={() => setColorScheme("light")}
            />
            <ToggleGroupItem
              // TRANSLATORS: dark color scheme option
              text={_("Dark")}
              isSelected={colorScheme === "dark"}
              onChange={() => setColorScheme("dark")}
            />
          </ToggleGroup>
        </StackItem>
        <StackItem>
          <Content component="small">{_("Contrast")}</Content>
          <ToggleGroup aria-label={_("Contrast")}>
            <ToggleGroupItem
              // TRANSLATORS: contrast option that follows the operating system setting
              text={_("System")}
              isSelected={contrast === "system"}
              onChange={() => setContrast("system")}
            />
            <ToggleGroupItem
              // TRANSLATORS: normal contrast option
              text={_("Standard")}
              isSelected={contrast === "standard"}
              onChange={() => setContrast("standard")}
            />
            <ToggleGroupItem
              // TRANSLATORS: increased contrast option for improved readability
              text={_("High")}
              isSelected={contrast === "high"}
              onChange={() => setContrast("high")}
            />
          </ToggleGroup>
        </StackItem>
      </Stack>
    </Dropdown>
  );
}
