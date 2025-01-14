/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import React, { useState } from "react";
import {
  Alert,
  Bullseye,
  Button,
  Card,
  CardBody,
  Content,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Flex,
  Grid,
  GridItem,
  Stack,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";
import alignmentStyles from "@patternfly/react-styles/css/utilities/Alignment/alignment";
import { useInstallerStatus } from "~/queries/status";
import { useConfig } from "~/queries/storage";
import { finishInstallation } from "~/api/manager";
import { InstallationPhase } from "~/types/status";
import { Navigate } from "react-router-dom";
import { ROOT as PATHS } from "~/routes/paths";

const TpmHint = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const title = _("TPM sealing requires the new system to be booted directly.");

  return (
    <Alert isInline className={alignmentStyles.textAlignStart} title={<strong>{title}</strong>}>
      <Stack hasGutter>
        {_("If a local media was used to run this installer, remove it before the next boot.")}
        <ExpandableSection
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          toggleText={isExpanded ? _("Hide details") : _("See more details")}
        >
          {
            // TRANSLATORS: "Trusted Platform Module" is the name of the technology and "TPM" its abbreviation
            _(
              "The final step to configure the Trusted Platform Module (TPM) to automatically \
open encrypted devices will take place during the first boot of the new system. For that to work, \
the machine needs to boot directly to the new boot loader.",
            )
          }
        </ExpandableSection>
      </Stack>
    </Alert>
  );
};

const SuccessIcon = () => <Icon name="check_circle" className="icon-xxxl color-success" />;

// TODO: define some utility method to get the device used as root (drive, partition, logical volume).
// TODO: use type checking for config.
function usingTpm(config): boolean {
  const { guided, drives = [], volumeGroups = [] } = config;

  if (guided !== undefined) {
    return guided.encryption?.method === "tpm_fde";
  }
  const devices = [
    ...drives,
    ...drives.flatMap((d) => d.partitions || []),
    ...volumeGroups.flatMap((v) => v.logicalVolumes || []),
  ];

  const root = devices.find((d) => d.filesystem?.path === "/");

  return root?.encryption?.tpmFde !== undefined;
}

function InstallationFinished() {
  const { phase, isBusy, useIguana } = useInstallerStatus({ suspense: true });
  const config = useConfig();

  if (phase !== InstallationPhase.Install) {
    return <Navigate to={PATHS.root} />;
  }

  if (isBusy) {
    return <Navigate to={PATHS.installationProgress} />;
  }

  return (
    <Bullseye>
      <Grid hasGutter>
        <GridItem sm={8} smOffset={2}>
          <Card>
            <CardBody>
              <Stack hasGutter>
                <EmptyState
                  variant="xl"
                  titleText={_("Congratulations!")}
                  headingLevel="h2"
                  icon={SuccessIcon}
                >
                  <EmptyStateBody>
                    <Flex
                      direction={{ default: "column" }}
                      rowGap={{ default: "rowGapMd" }}
                      justifyContent={{ default: "justifyContentCenter" }}
                    >
                      <Content>{_("The installation on your machine is complete.")}</Content>
                      <Content>
                        {useIguana
                          ? _("At this point you can power off the machine.")
                          : _(
                              "At this point you can reboot the machine to log in to the new system.",
                            )}
                      </Content>
                      {usingTpm(config) && <TpmHint />}
                    </Flex>
                  </EmptyStateBody>
                </EmptyState>
                <Flex direction={{ default: "rowReverse" }}>
                  <Button size="lg" variant="primary" onClick={finishInstallation}>
                    {useIguana ? _("Finish") : _("Reboot")}
                  </Button>
                </Flex>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Bullseye>
  );
}

export default InstallationFinished;
