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

import React, { useId } from "react";
import { Content, Flex, FlexItem, Switch, SwitchProps } from "@patternfly/react-core";
import { TranslatedString } from "~/i18n";

type SwitchEnhancedProps = Omit<
  SwitchProps,
  "ref" | "label" | "aria-labelledby" | "aria-describedby"
> & {
  /** Must describe the isChecked="true" state. */
  label: TranslatedString;
  /** Description or helper text displayed below the label. */
  description: React.ReactNode;
};

/**
 * A wrapper around PatternFly's `Switch` component that adds support for a
 * description or helper text displayed below the label.
 *
 * This component is useful when users can benefit from additional context about
 * the switch’s function.
 *
 * Use this component when a toggle requires more explanation. If no description
 * is needed, prefer using the standard PatternFly `Switch` component directly.
 *
 * @example
 * ```tsx
 * <SwitchEnhanced
 *   id="installation-only-connection"
 *   label="Use for installation only"
 *   description="The connection will be used only during installation and not persisted to the installed system."
 *   isChecked={isEnabled}
 *   onChange={toggleEmailNotifications}
 * />
 * ```
 */
export default function SwitchEnhanced({ description, label, ...props }: SwitchEnhancedProps) {
  const switchId = useId();
  // NOTE: `labelId` isn't actually needed because the usage of `label#htmlFor`.
  // It remains to satisfy PatternFly/Switch component, which requires at least
  // one of `label`, `aria-labelledby`, or `aria-label` props, None of them
  // strictly needed with the approach followed here.
  const labelId = useId();
  const descriptionId = useId();

  return (
    <Flex flexWrap={{ default: "nowrap" }} alignItems={{ default: "alignItemsFlexStart" }}>
      <FlexItem>
        <Switch
          {...props}
          id={switchId}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
        />
      </FlexItem>
      <FlexItem>
        <Content isEditorial>
          <label id={labelId} htmlFor={switchId}>
            {label}
          </label>
        </Content>
        <Content component="small" id={descriptionId}>
          {description}
        </Content>
      </FlexItem>
    </Flex>
  );
}
