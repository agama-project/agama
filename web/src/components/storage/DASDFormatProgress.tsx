/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { Progress, Stack } from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { _ } from "~/i18n";
import { useDASDDevices, useDASDRunningFormatJobs } from "~/queries/dasd";
import { DASDDevice, FormatSummary } from "~/types/dasd";

const DeviceProgress = ({ device, progress }: { device: DASDDevice; progress: FormatSummary }) => (
  <Progress
    key={`progress_${device.id}`}
    size="sm"
    max={progress.total}
    value={progress.step}
    title={`${device.id} - ${device.deviceName}`}
    measureLocation="none"
    variant={progress.done ? "success" : undefined}
  />
);

export default function DASDFormatProgress() {
  const devices = useDASDDevices();
  const runningJobs = useDASDRunningFormatJobs().filter(
    (job) => Object.keys(job.summary || {}).length > 0,
  );

  return (
    <Popup title={_("Formatting DASD devices")} isOpen={runningJobs.length > 0} disableFocusTrap>
      <Stack hasGutter className="dasd-format-progress">
        {runningJobs.map((job) =>
          Object.entries(job.summary).map(([id, progress]) => {
            const device = devices.find((d) => d.id === id);
            return (
              <DeviceProgress key={`${id}-format-progress`} device={device} progress={progress} />
            );
          }),
        )}
      </Stack>
    </Popup>
  );
}
