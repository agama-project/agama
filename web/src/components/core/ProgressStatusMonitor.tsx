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

import React, { useRef } from "react";
import { Button, Divider, Flex, Popover, Stack } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import VisualTooltip from "~/components/core/VisualTooltip";
import Text from "~/components/core/Text";
import { useStatus } from "~/hooks/model/status";
import { sprintf } from "sprintf-js";
import { _, N_, n_ } from "~/i18n";
import type { Progress as StatusProgress } from "~/model/status";

type DetailProps = {
  tasks: StatusProgress[];
};

/**
 * Maps internal task scope identifiers to localized names.
 */
const SCOPE_NAMES = {
  software: N_("Software"),
  storage: N_("Storage"),
  network: N_("Network"),
  l10n: N_("Localization"),
};

/**
 * Renders the header text for the popover, indicating how many tasks are
 * currently active.
 */
const DetailsHeader = ({ tasks }: DetailProps) => {
  const total = tasks.length;
  return sprintf(n_("%s task active", "%s tasks active", total), total);
};

/**
 * Renders a list of compact progress bars for each background task.
 */
const DetailsBody = ({ tasks }: DetailProps) => {
  return tasks.map((task, index) => {
    return (
      <React.Fragment key={task.scope}>
        <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
          <div>
            <Text isBold>
              {
                /* eslint-disable agama-i18n/string-literals -- SCOPE_NAMES are already marked for translation with N_ */
                _(SCOPE_NAMES[task.scope])
              }
            </Text>
          </div>

          <div>
            {task.step} <small>{sprintf(_("(step %s of %s)"), task.index, task.size)}</small>
          </div>
        </Flex>
        {index < tasks.length - 1 && <Divider />}
      </React.Fragment>
    );
  });
};

/**
 * Displays a progress status widget for monitoring background tasks.
 *
 * The component shows two states:
 *
 *  - **Idle (list_alt_check icon)**: No background tasks running
 *  - **Busy (spinner)**: Background tasks in progress
 *
 * Clicking the button opens a popover showing:
 *
 *  - When idle: "No pending tasks"
 *  - When busy: Number of tasks and detailed progress for each scope
 *
 * The button remains always visible for discoverability and predictable UI,
 * with appropriate aria-label updates for screen reader users.
 */
export default function ProgressStatusMonitor() {
  const { progresses: tasks } = useStatus();
  const idle = tasks.length === 0;
  // Shared by the popover (its external trigger) and the visual-only tooltip.
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Determine icon and aria-label based on state
  let icon: React.ReactNode;
  let ariaLabel: string;

  if (!idle) {
    // Busy: show spinner
    icon = undefined;
    // TRANSLATORS: label for the background tasks status button when tasks are
    // active; %s is replaced by the number of active tasks
    ariaLabel = sprintf(
      n_("Status: %s task active", "Status: %s tasks active", tasks.length),
      tasks.length,
    );
  } else {
    // Idle: show list_alt_check
    icon = <Icon name="list_alt_check" isMiddleAligned />;
    // TRANSLATORS: label for the system status button when there are no
    // background tasks running
    ariaLabel = _("Status: Idle");
  }

  // Popover header and body depend on state
  let headerContent: React.ReactNode;
  let bodyContent: React.ReactNode;

  if (!idle) {
    // Busy: show task details
    headerContent = <DetailsHeader tasks={tasks} />;
    bodyContent = (
      <Stack hasGutter>
        <DetailsBody tasks={tasks} />
      </Stack>
    );
  } else {
    // Idle: show no tasks message
    // TRANSLATORS: header when no background tasks are running
    headerContent = _("No pending tasks");
    // TRANSLATORS: message when all background tasks completed
    bodyContent = <Text>{_("All background tasks completed")}</Text>;
  }

  return (
    <>
      <VisualTooltip content={ariaLabel}>
        <Button ref={triggerRef} variant="plain" isLoading={!idle} aria-label={ariaLabel}>
          {icon}
          <Text srOnly aria-live="polite" aria-atomic="true">
            {!idle && ariaLabel}
          </Text>
        </Button>
      </VisualTooltip>
      <Popover
        triggerRef={triggerRef}
        showClose={false}
        minWidth="400px"
        position="bottom-end"
        headerContent={headerContent}
        bodyContent={bodyContent}
      />
    </>
  );
}
