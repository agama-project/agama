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
import {
  Button,
  Divider,
  HelperText,
  HelperTextItem,
  Popover,
  Progress,
  Stack,
} from "@patternfly/react-core";
import { useStatus } from "~/hooks/api/status";
import { sprintf } from "sprintf-js";
import { _, N_, n_ } from "~/i18n";
import displayStyles from "@patternfly/react-styles/css/utilities/Display/display";
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
    const value = (task.index / task.size) * 100;
    return (
      <React.Fragment key={task.scope}>
        <Progress
          /* eslint-disable agama-i18n/string-literals -- SCOPE_NAMES are already marked for translation with N_ */
          title={_(SCOPE_NAMES[task.scope])}
          value={value}
          size="sm"
          helperText={
            <HelperText>
              <HelperTextItem>{task.step}</HelperTextItem>
            </HelperText>
          }
        />
        {index < tasks.length - 1 && <Divider />}
      </React.Fragment>
    );
  });
};

/**
 * Displays a small status widget that indicates when background tasks (as
 * reported by `useStatus`) are running.
 *
 * When tasks are active, the component shows a loading indicator inside a
 * button. Clicking this button opens a popover that presents details about the
 * ongoing work.
 *
 * The popover shows:
 *
 *  - The number of active tasks
 *  - A list of progress bars, one per task scope
 *
 * Intended as a lightweight monitor for background activity.
 */
export default function ProgressStatusMonitor() {
  const { progresses: tasks } = useStatus();

  const idle = tasks.length === 0;

  return (
    <Popover
      showClose={false}
      minWidth="400px"
      position="bottom-end"
      headerContent={<DetailsHeader tasks={tasks} />}
      bodyContent={
        <Stack hasGutter>
          <DetailsBody tasks={tasks} />
        </Stack>
      }
    >
      <Button
        variant="plain"
        className={idle ? displayStyles.displayNone : displayStyles.displayBlock}
        isDisabled={idle}
        isLoading={!idle}
      />
    </Popover>
  );
}
