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
import statuses from "./lib/client/statuses";

import { Alert, Button, Progress, Stack, StackItem, Text } from "@patternfly/react-core";

import Center from "./Center";
import Layout from "./Layout";
import Category from "./Category";
import InstallationFinished from "./InstallationFinished";

import {
  EOS_DOWNLOADING as ProgressIcon,
  EOS_THREE_DOTS_LOADING_ANIMATED as LoadingIcon
} from "eos-icons-react";

const { PROBING, INSTALLING, INSTALLED } = statuses;

const renderSubprogress = progress => {
  return (
    <Progress
      size="sm"
      measureLocation="none"
      aria-label={`${progress.title} substep progress`}
      value={Math.round((progress.substep / progress.substeps) * 100)}
    />
  );
};

const renderProgress = progress => {
  if (!progress) {
    return (
      <StackItem className="component--centered">
        <LoadingIcon size="10rem" />
      </StackItem>
    );
  }

  const showSubsteps = !!progress.substeps && progress.substeps >= 0;
  const percentage = progress.steps === 0 ? 0 : Math.round((progress.step / progress.steps) * 100);

  return (
    <>
      <StackItem>
        <Progress title={progress.title} value={percentage} />
      </StackItem>

      <StackItem>{showSubsteps && renderSubprogress(progress)}</StackItem>
    </>
  );
};

function InstallationProgress() {
  const client = useInstallerClient();
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    return client.manager.onChange(changes => {
      if ("Progress" in changes) {
        const [title, steps, step, substeps, substep] = changes.Progress;
        setProgress({ title, steps, step, substeps, substep });
      }
    });
  }, []);

  const status = client.manager.getStatus();
  const mainTitle = status === INSTALLING ? "Installing" : "Probing"; // so far only two actions need progress

  // FIXME: this is an example. Update or drop it.
  const Actions = () => {
    if (status === PROBING) return null;

    return (
      <Button
        isDisabled
        onClick={() =>
          console.log("FIXME: use the button for triggering useful action while installing?")
        }
      >
        Finish
      </Button>
    );
  };

  if (status === INSTALLED) return <InstallationFinished />;

  return (
    <Layout sectionTitle={mainTitle} SectionIcon={ProgressIcon} FooterActions={Actions}>
      <Center>
        <Stack hasGutter className="pf-u-w-100">
          {renderProgress(progress)}
        </Stack>
      </Center>
    </Layout>
  );
}

export default InstallationProgress;
