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
import { Content, Radio, RadioProps } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

type RadioEnhancedProps = Omit<RadioProps, "ref">;

/**
 * A wrapper around PF/Radio component, intended to ensure a consistent
 * appearance across Agama without code repetition.
 *
 * It automatically applies a slightly larger font size to the `label`.
 * Additionally, when the radio button is checked, the label becomes bold,
 * providing a clear visual cue for the selected state.
 */
export default function RadioEnhanced({ label, isChecked, ...props }: RadioEnhancedProps) {
  return (
    <Radio
      label={
        <Content
          className={[textStyles.fontSizeLg, isChecked && textStyles.fontWeightBold].join(" ")}
        >
          {label}
        </Content>
      }
      isChecked={isChecked}
      {...props}
    />
  );
}
