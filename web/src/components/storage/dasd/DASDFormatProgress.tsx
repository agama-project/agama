/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { Progress, Stack } from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { _ } from "~/i18n";

import type { Device } from "~/model/system/dasd";

// FIXME: adapt to new API
type FormatSummary = {
  total: number;
  step: number;
  done: boolean;
};

type FormatJob = {
  jobId: string;
  summary?: { [key: string]: FormatSummary };
};

const DeviceProgress = ({ device, progress }: { device: Device; progress: FormatSummary }) => (
  <Progress
    key={`progress_${device.channel}`}
    size="sm"
    max={progress.total}
    value={progress.step}
    title={`${device.channel} - ${device.deviceName}`}
    measureLocation="none"
    variant={progress.done ? "success" : undefined}
  />
);

export default function DASDFormatProgress() {
  const devices = []; // FIXME: use APIv2 equivalent to useDASDDevices();
  const runningJobs: FormatJob[] = []; // FIXME use APIv2 equivalent to useDASDRunningFormatJobs()

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
