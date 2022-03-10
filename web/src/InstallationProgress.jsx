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

import { Alert, Bullseye, Button, Progress, Stack, StackItem } from "@patternfly/react-core";

import Layout from "./Layout";
import Category from "./Category";

import { EOS_DOWNLOADING as ProgressIcon } from "eos-icons-react";

function InstallationProgress() {
  const client = useInstallerClient();
  const [progress, setProgress] = useState({});

  useEffect(() => {
    return client.onPropertyChanged((_path, _iface, signal, args) => {
      const iface = "org.opensuse.DInstaller.Manager1";
      const [input_iface, changed] = args;
      if (input_iface === iface && "Progress" in changed) {
        const [title, steps, step, substeps, substep] = changed.Progress.v.map(pr => pr.v);
        setProgress({ title, steps, step, substeps, substep });
      }
    });
  }, []);

  const showSubsteps = !!progress.substeps && progress.substeps >= 0;
  const percentage = progress.steps === 0 ? 0 : Math.round((progress.step / progress.steps) * 100);

  // FIXME: this is an example. Update or drop it.
  const Messages = () => {
    return (
      <Alert variant="info" isInline isPlain title="Did you know?">
        You can <a href="#">read the release notes</a> while the system is being installed.
      </Alert>
    );
  };

  // FIXME: this is an example. Update or drop it.
  const Actions = () => {
    return (
      <Button isDisabled onClick={() => console.log("User want to see the summary!")}>
        Reboot system
      </Button>
    );
  };

  const renderSubprogress = () => {
    if (!showSubsteps) return;

    return (
      <StackItem>
        <Progress
          title={progress.title}
          value={Math.round((progress.substep / progress.substeps) * 100)}
        />
      </StackItem>
    );
  };

  return (
    <Layout
      sectionTitle="Installing"
      SectionIcon={ProgressIcon}
      FooterMessages={Messages}
      FooterActions={Actions}
    >
      <Bullseye className="layout__content-child--filling-block-size">
        <Stack hasGutter className="pf-u-w-100">
          <StackItem>
            <Progress title="Overall progress" value={percentage} />
          </StackItem>

          {renderSubprogress()}
        </Stack>
      </Bullseye>
    </Layout>
  );
}

export default InstallationProgress;
