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

import { useState, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import { EOS_DOWNLOADING as ProgressIcon } from "eos-icons-react";
import Category from "./Category";
import { Progress, Stack, StackItem } from "@patternfly/react-core";

function InstallationProgress() {
  const client = useInstallerClient();
  const [progress, setProgress] = useState({});

  useEffect(() => {
    return client.onSignal("Progress", (_path, _iface, _signal, args) => {
      const [title, steps, step, substeps, substep] = args;
      const progress = { title, steps, step, substeps, substep };
      setProgress(progress);
    });
  }, []);

  console.log(progress.substeps);
  return (
    <Stack hasGutter>
      <StackItem>
        <Category title="Progress" icon={ProgressIcon}>
          <Progress
            title="Installing"
            value={Math.round((progress.step / progress.steps) * 100)}
          />
          {progress.substeps && progress.substeps >= 0 && (
            <Progress
              title={progress.title}
              value={Math.round((progress.substep / progress.substeps) * 100)}
            />
          )}
        </Category>
      </StackItem>
    </Stack>
  );
}

export default InstallationProgress;
