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

import React, { useId, useRef } from "react";
import {
  Button,
  Content,
  Divider,
  Popover,
  Stack,
  StackItem,
  ToggleGroup,
  ToggleGroupItem,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import VisualTooltip from "~/components/core/VisualTooltip";
import Text from "~/components/core/Text";
import { useAppearance } from "~/context/appearance";
import { _ } from "~/i18n";
import Interpolate from "./Interpolate";

/**
 * Lets the user adjust the interface appearance along two independent axes: the
 * color scheme (Automatic/Light/Dark) and the contrast level
 * (Automatic/Standard/High). "Automatic" follows the browser/OS preference.
 *
 * Rendered as an icon button that opens a popover with a button group per axis.
 * A popover (not a menu/dropdown) is used so the groups are reachable by
 * keyboard: the popover traps focus and Tab moves between the option buttons.
 * The selection is applied to the document root and persisted by
 * {@link useAppearance}.
 */
export default function AppearanceSettings(): React.ReactNode {
  const { colorScheme, setColorScheme, contrast, setContrast } = useAppearance();
  const colorSchemeId = useId();
  const contrastId = useId();
  // Shared by the popover (its external trigger) and the visual-only tooltip.
  const triggerRef = useRef<HTMLButtonElement>(null);

  // TRANSLATORS: accessible name for the button that opens the appearance settings
  const appearanceLabel = _("Appearance");
  // TRANSLATORS: label for the group of color scheme options (Automatic, Light, Dark)
  const colorSchemeLabel = _("Color scheme");
  // TRANSLATORS: label for the group of contrast options (Automatic, Standard, High)
  const contrastLabel = _("Contrast");

  const settings = (
    <Stack hasGutter>
      <StackItem>
        <Content component="small" id={colorSchemeId}>
          {colorSchemeLabel}
        </Content>
        <ToggleGroup aria-labelledby={colorSchemeId}>
          <ToggleGroupItem
            // TRANSLATORS: short label for the option shown in the UI
            text={_("Automatic")}
            // TRANSLATORS: accessible name for the color scheme option that follows the OS
            aria-label={_("Automatic color scheme")}
            isSelected={colorScheme === "system"}
            onChange={() => setColorScheme("system")}
          />
          <ToggleGroupItem
            // TRANSLATORS: short label for the option shown in the UI
            text={_("Light")}
            // TRANSLATORS: accessible name for the bright color scheme option
            aria-label={_("Light color scheme")}
            isSelected={colorScheme === "light"}
            onChange={() => setColorScheme("light")}
          />
          <ToggleGroupItem
            // TRANSLATORS: short label for the option shown in the UI
            text={_("Dark")}
            // TRANSLATORS: accessible name for the dark color scheme option
            aria-label={_("Dark color scheme")}
            isSelected={colorScheme === "dark"}
            onChange={() => setColorScheme("dark")}
          />
        </ToggleGroup>
      </StackItem>
      <StackItem>
        <Content component="small" id={contrastId}>
          {contrastLabel}
        </Content>
        <ToggleGroup aria-labelledby={contrastId}>
          <ToggleGroupItem
            // TRANSLATORS: short label for the option shown in the UI
            text={_("Automatic")}
            // TRANSLATORS: accessible name for the contrast option that follows the OS
            aria-label={_("Automatic contrast")}
            isSelected={contrast === "system"}
            onChange={() => setContrast("system")}
          />
          <ToggleGroupItem
            // TRANSLATORS: short label for the option shown in the UI
            text={_("Standard")}
            // TRANSLATORS: accessible name for the normal contrast option
            aria-label={_("Standard contrast")}
            isSelected={contrast === "standard"}
            onChange={() => setContrast("standard")}
          />
          <ToggleGroupItem
            // TRANSLATORS: short label for the option shown in the UI
            text={_("High")}
            // TRANSLATORS: accessible name for the increased contrast option
            aria-label={_("High contrast")}
            isSelected={contrast === "high"}
            onChange={() => setContrast("high")}
          />
        </ToggleGroup>
      </StackItem>
      <StackItem>
        <Divider />
        <Text component="small" textStyle={["textColorSubtle", "fontSizeXs"]}>
          <Interpolate
            sentence={
              // TRANSLATORS: explains the "Automatic" appearance option; %s is
              // replaced by the "Automatic" option name (shown quoted)
              _("%s honors the browser and system preferences")
            }
          >
            {/* TRANSLATORS: the "Automatic" appearance option name */}
            {() => <span className="in-quotes">{_("Automatic")}</span>}
          </Interpolate>
        </Text>
      </StackItem>
    </Stack>
  );

  return (
    <>
      <VisualTooltip content={appearanceLabel}>
        <Button ref={triggerRef} variant="plain" aria-label={appearanceLabel}>
          <Icon name="routine" isMiddleAligned />
        </Button>
      </VisualTooltip>
      <Popover
        triggerRef={triggerRef}
        aria-label={appearanceLabel}
        headerContent={appearanceLabel}
        bodyContent={settings}
        hasAutoWidth
        position="bottom-end"
        appendTo={() => document.body}
      />
    </>
  );
}
