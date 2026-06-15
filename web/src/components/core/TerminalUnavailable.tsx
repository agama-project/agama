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
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { _ } from "~/i18n";

/**
 * Message shown in place of the terminal when the available area is too small
 * to use it comfortably (for example, on phones or in a narrow window).
 *
 * It explains the situation and points to alternatives, never to a specific
 * device or gesture, so it stays accurate on any screen.
 */
export default function TerminalUnavailable() {
  return (
    <EmptyState
      variant={EmptyStateVariant.sm}
      // TRANSLATORS: shown when there is not enough room on screen to use the
      // terminal; it asks the user to make room or use the command line instead.
      titleText={_("The terminal needs more space than this screen has.")}
      headingLevel="h3"
      icon={() => <Icon name="terminal" />}
    >
      <EmptyStateBody>
        {/* TRANSLATORS: tells the user how to get enough room for the terminal */}
        {_("Make the window larger to use it here.")}
      </EmptyStateBody>
      <EmptyStateFooter>
        {/* TRANSLATORS: points the user to the system command line as an
            alternative when the terminal does not fit on the screen */}
        {_("Or run commands directly from the command line.")}
      </EmptyStateFooter>
    </EmptyState>
  );
}
