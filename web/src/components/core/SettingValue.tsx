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

import React from "react";
import {
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
} from "@patternfly/react-core";
import Icon, { IconProps } from "~/components/layout/Icon";
import Text from "~/components/core/Text";

export type SettingValueProps = {
  /** Names the setting: what has been decided, not what to do about it. */
  term: React.ReactNode;
  /**
   * What it is set to. A control here, a link or a menu, makes the value itself
   * the way to change it, which keeps a summary readable at a glance instead of
   * turning it into a form.
   */
  value?: React.ReactNode;
  /** Only when there is something to say that the value does not already say. */
  explanation?: React.ReactNode;
  /**
   * A mark beside the term. Decorative, and hidden from screen readers: the
   * term says what the row is about. It gives the eye a rail down a list of
   * settings without a box being drawn around each.
   */
  icon?: IconProps["name"];
};

/**
 * One setting of a summary: a term, what it is set to, and why that matters.
 *
 * Settings are read far more often than they are changed, so they are written
 * as values rather than as fields: "Encryption Disabled" says what is true, and
 * where the value is a link it is also the way to change it.
 *
 * A screen reader announces the pair together, "Encryption, Disabled", because
 * this is one entry of a description list. It therefore has to be rendered
 * inside a PatternFly `DescriptionList`, which also decides whether the values
 * sit beside their terms or under them.
 *
 * @example
 * <DescriptionList isCompact isHorizontal isFluid>
 *   <SettingValue
 *     icon="lock"
 *     term={_("Encryption")}
 *     value={
 *       <Button variant="link" isInline onClick={goToEncryption}>
 *         {_("Disabled")}
 *       </Button>
 *     }
 *   />
 * </DescriptionList>
 */
export default function SettingValue({ term, value, explanation, icon }: SettingValueProps) {
  return (
    <DescriptionListGroup>
      <DescriptionListTerm icon={icon && <Icon name={icon} size="xs" aria-hidden />}>
        {term}
      </DescriptionListTerm>
      <DescriptionListDescription>
        {value}
        {explanation && (
          <div>
            <Text component="small" textStyle="textColorSubtle">
              {explanation}
            </Text>
          </div>
        )}
      </DescriptionListDescription>
    </DescriptionListGroup>
  );
}
