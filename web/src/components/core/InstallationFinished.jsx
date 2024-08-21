/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  EmptyStateHeader,
  EmptyStateIcon,
  ExpandableSection,
  Flex,
  Grid,
  GridItem,
  Stack,
  Text,
} from "@patternfly/react-core";
import SimpleLayout from "~/SimpleLayout";
import { Center, Icon } from "~/components/layout";
import { EncryptionMethods } from "~/client/storage";
import { _ } from "~/i18n";
import { useInstallerClient } from "~/context/installer";
import alignmentStyles from "@patternfly/react-styles/css/utilities/Alignment/alignment";
import { useInstallerStatus } from "~/queries/status";

const TpmHint = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const title = _("TPM sealing requires the new system to be booted directly.");

  return (
    <Alert isInline className={alignmentStyles.textAlignLeft} title={<strong>{title}</strong>}>
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

function InstallationFinished() {
  const client = useInstallerClient();
  const { useIguana } = useInstallerStatus({ suspense: true });
  const [usingTpm, setUsingTpm] = useState(false);
  const closingAction = () => client.manager.finishInstallation();

  useEffect(() => {
    async function preparePage() {
      // FIXME: This logic should likely not be placed here, it's too coupled to storage internals.
      // Something to fix when this whole page is refactored in a (hopefully near) future.
      const {
        settings: { encryptionPassword, encryptionMethod },
      } = await client.storage.proposal.getResult();
      setUsingTpm(encryptionPassword?.length > 0 && encryptionMethod === EncryptionMethods.TPM);
    }

    // TODO: display the page in a loading mode while needed data is being fetched.
    preparePage();
  });

  return (
    <SimpleLayout showOutlet={false}>
      <Center>
        <Grid hasGutter>
          <GridItem sm={8} smOffset={2}>
            <Card isRounded>
              <CardBody>
                <Stack hasGutter>
                  <EmptyState variant="xl">
                    <EmptyStateHeader
                      titleText={_("Congratulations!")}
                      headingLevel="h2"
                      icon={<EmptyStateIcon icon={SuccessIcon} />}
                    />
                    <EmptyStateBody>
                      <Flex
                        rowGap={{ default: "rowGapMd" }}
                        justifyContent={{ default: "justifyContentCenter" }}
                      >
                        <Text>{_("The installation on your machine is complete.")}</Text>
                        <Text>
                          {useIguana
                            ? _("At this point you can power off the machine.")
                            : _(
                                "At this point you can reboot the machine to log in to the new system.",
                              )}
                        </Text>
                        {usingTpm && <TpmHint />}
                      </Flex>
                    </EmptyStateBody>
                  </EmptyState>
                  <Flex direction={{ default: "rowReverse" }}>
                    <Button size="lg" variant="primary" onClick={closingAction}>
                      {useIguana ? _("Finish") : _("Reboot")}
                    </Button>
                  </Flex>
                </Stack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </Center>
    </SimpleLayout>
  );
}

export default InstallationFinished;
