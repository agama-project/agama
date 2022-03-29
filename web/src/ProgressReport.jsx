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
    max={progress.substeps}
    value={progress.substep}
    measureLocation="none"
    aria-label="Secondary progress bar"
  />
);

const ProgressReport = () => {
  const client = useInstallerClient();
  const [progress, setProgress] = useState({});

  useEffect(() => {
    return client.manager.onChange(changes => {
      if ("Progress" in changes) {
        const [title, steps, step, substeps, substep] = changes.Progress;
        setProgress({ title, steps, step, substeps, substep });
      }
    });
  }, []);

  if (!progress.steps) return <Text>Waiting for progress status...</Text>;

  const showSubsteps = !!progress.substeps && progress.substeps >= 0;
  const label = `Step ${progress.step + 1} of ${progress.steps + 1}`;

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

      <StackItem>{showSubsteps && renderSubprogress(progress)}</StackItem>
    </Stack>
  );
};

export default ProgressReport;
