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
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";

import { Grid, GridItem, Progress, Text } from "@patternfly/react-core";

const ProgressReport = () => {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  // progress and subprogress are basically objects containing { message, step, steps }
  const [progress, setProgress] = useState({});
  const [subProgress, setSubProgress] = useState(undefined);

  useEffect(() => {
    cancellablePromise(client.manager.getProgress()).then(({ message, current, total }) => {
      setProgress({ message, step: current, steps: total });
    });
  }, [client.manager, cancellablePromise]);

  useEffect(() => {
    return client.manager.onProgressChange(({ message, current, total, finished }) => {
      if (!finished) setProgress({ message, step: current, steps: total });
    });
  }, [client.manager]);

  useEffect(() => {
    return client.software.onProgressChange(({ message, current, total, finished }) => {
      if (finished) {
        setSubProgress(undefined);
      } else {
        setSubProgress({ message, step: current, steps: total });
      }
    });
  }, [client.software]);

  if (!progress.steps) return <Text>Waiting for progress status...</Text>;

  return (
    <Grid hasGutter>
      <GridItem sm={12}>
        <Progress
          min={0}
          max={progress.steps}
          value={progress.step}
          title={progress.message}
          label={" "}
          aria-label={progress.message}
        />

        <Progress
          size="sm"
          min={0}
          max={subProgress?.steps}
          value={subProgress?.step}
          title={subProgress?.message}
          label={" "}
          measureLocation="none"
          className={!subProgress && 'hidden'}
          aria-label={subProgress?.message || " "}
          aria-hidden={!subProgress}
        />
      </GridItem>
    </Grid>
  );
};

export default ProgressReport;
