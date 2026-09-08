/*
 * Copyright (c) [2022-2026] SUSE LLC
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
  Button,
  Content,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { useReset } from "~/hooks/model/config/storage";
import { _ } from "~/i18n";

/**
 * Shown instead of the page when the storage configuration is made of things
 * this interface cannot represent, and so cannot let the reader change.
 */
export default function UnknownConfigMessage(): React.ReactNode {
  const reset = useReset();

  return (
    <EmptyState
      headingLevel="h2"
      titleText={_("Unable to modify the settings")}
      icon={() => <Icon name="error" />}
      status="warning"
    >
      <EmptyStateBody>
        <Content component="p">
          {_("The storage configuration uses elements not supported by this interface.")}
        </Content>
      </EmptyStateBody>
      <EmptyStateFooter>
        <Content component="p">
          {_(
            "You may want to discard the current settings and start from scratch with a simple configuration.",
          )}
        </Content>
        <Button variant="secondary" onClick={() => reset()}>
          {_("Reset to the default configuration")}
        </Button>
      </EmptyStateFooter>
    </EmptyState>
  );
}
