/*
 * Copyright (c) [2022] SUSE LLC
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

import React, { useState, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import { Progress, Stack, StackItem, Text } from "@patternfly/react-core";

const renderSubprogress = progress => (
  <Progress
    size="sm"
    min={0}
    max={progress.steps}
    value={progress.step}
    label={progress.message}
    valueText={progress.message}
    measureLocation="none"
    aria-label="Secondary progress bar"
  />
);

const ProgressReport = () => {
  const client = useInstallerClient();
  // progress and subprogress are basically objects containing { title, step, steps }
  const [progress, setProgress] = useState({});
  const [subProgress, setSubProgress] = useState(undefined);

  useEffect(() => {
    return client.manager.onProgressChange(({ message, current, total }) => {
      setProgress({ title: message, step: current, steps: total });
    });
  }, [client.manager]);

  useEffect(() => {
    return client.software.onProgressChange(({ message, current, total, finished }) => {
      setSubProgress({ title: message, step: current, steps: total, finished });
    });
  }, [client.software]);

  if (!progress.steps) return <Text>Waiting for progress status...</Text>;

  const showSubsteps = subProgress && !subProgress.finished;
  const label = `${progress.step} of ${progress.steps}`;

  return (
    <Stack hasGutter className="pf-u-w-100">
      <StackItem>
        <Progress
          min={0}
          max={progress.steps}
          value={progress.step}
          label={label}
          valueText={label}
          title={progress.title}
          aria-label="Main progress bar"
        />
      </StackItem>

      <StackItem>{showSubsteps && renderSubprogress(subProgress)}</StackItem>
    </Stack>
  );
};

export default ProgressReport;
