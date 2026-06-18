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
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateFooter,
  EmptyStateVariant,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { _ } from "~/i18n";

type TerminalUnavailableProps = {
  /** Hides the terminal panel. */
  onHide: () => void;
};

/**
 * Message shown in place of the terminal when the available area is too small
 * to use it comfortably (for example, on phones or in a narrow window).
 *
 * It states the situation without pointing to a specific device or gesture, so
 * it stays accurate on any screen, and offers to hide the panel.
 */
export default function TerminalUnavailable({ onHide }: TerminalUnavailableProps) {
  return (
    <EmptyState
      variant={EmptyStateVariant.sm}
      // TRANSLATORS: shown when the screen is too small to use the terminal
      titleText={_("The terminal requires a larger screen size")}
      headingLevel="h3"
      icon={() => <Icon name="terminal" />}
    >
      <EmptyStateFooter>
        <EmptyStateActions>
          {/* TRANSLATORS: button that hides the terminal panel */}
          <Button variant="primary" onClick={onHide}>
            {_("Hide terminal")}
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
}
