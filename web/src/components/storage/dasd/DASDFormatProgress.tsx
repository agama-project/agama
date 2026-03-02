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

import React, { useEffect, useState } from "react";
import { Card, CardBody, CardTitle, Progress, Stack } from "@patternfly/react-core";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";

import type { Device } from "~/model/system/dasd";

/**
 * Summary of an ongoing DASD formatting operation for a single device.
 *
 * It is received from the installer client via the `DASDFormatChanged` event
 * and represents the current formatting state of one DASD device.
 */
type FormatSummary = {
  /**
   * The channel identifier of the DASD device (e.g. "0.0.0200").
   */
  channel: Device["channel"];
  /**
   * Total number of cylinders to be formatted.
   */
  totalCylinders: number;
  /**
   * Number of cylinders that have already been formatted.
   */
  formattedCylinders: number;
  /**
   * Whether the formatting operation has completed.
   */
  finished: boolean;
};

/**
 * Renders a small progress bar for a single DASD formatting operation.
 */
const DeviceProgress = ({ progress }: { progress: FormatSummary }) => (
  <Progress
    size="sm"
    measureLocation="none"
    max={progress.totalCylinders}
    value={progress.formattedCylinders}
    title={progress.channel}
    variant={progress.finished ? "success" : undefined}
  />
);

/**
 * Displays progress information for currently running DASD format operations.
 *
 * The component subscribes to the installer client's `DASDFormatChanged` events
 * and updates its internal state accordingly.
 *
 * Rendering behavior:
 * - If no formatting operations are running, nothing is rendered.
 * - If at least one formatting summary is present, a progress card is shown.
 *
 * The component automatically unsubscribes from installer events when unmounted.
 */
export default function DASDFormatProgress() {
  const client = useInstallerClient();
  const [progress, setProgress] = useState<FormatSummary[]>([]);

  useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "DASDFormatChanged") {
        setProgress(event.summary);
      }
    });
  }, [client]);

  if (progress.length === 0) {
    return null;
  }

  return (
    <Card isPlain>
      <CardTitle>{_("Formatting devices progress")}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          {progress.map((p) => {
            return <DeviceProgress key={`${p.channel}-format-progress`} progress={p} />;
          })}
        </Stack>
      </CardBody>
    </Card>
  );
}
