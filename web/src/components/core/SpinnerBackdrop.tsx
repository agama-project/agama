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
import { Backdrop, Flex, Spinner } from "@patternfly/react-core";

import type { TranslatedString } from "~/i18n";

import sizingStyles from "@patternfly/react-styles/css/utilities/Sizing/sizing";

type SpinnerBackdropProps = {
  /** Spoken name of the spinner, telling what is being waited for. */
  label: TranslatedString;
};

/**
 * Blocks the page content with a big spinner and no text, while the interface
 * waits for something it does on its own.
 *
 * Meant for waits where words would not help, such as switching the interface
 * to another language: the current one may be the one the user cannot read.
 * For backend operations, which report their steps, use `ProgressBackdrop`.
 */
export default function SpinnerBackdrop({ label }: SpinnerBackdropProps) {
  return (
    <Backdrop className="agm-main-content-overlay">
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        justifyContent={{ default: "justifyContentCenter" }}
        className={sizingStyles.h_100}
      >
        <Spinner size="xl" aria-label={label} />
      </Flex>
    </Backdrop>
  );
}
