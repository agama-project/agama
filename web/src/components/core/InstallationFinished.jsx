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
import {
  Text,
  EmptyState,
  EmptyStateBody,
  EmptyStateHeader,
  EmptyStateIcon,
  ExpandableSection,
  Hint,
  HintBody,
} from "@patternfly/react-core";

import { Page, If } from "~/components/core";
import { Center, Icon } from "~/components/layout";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";

const TpmHint = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Hint>
      <HintBody>
        <ExpandableSection
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          toggleText={
            <strong>
              {_("Make sure to boot directly to the new system to finish the configuration of TPM-based decryption.")}
            </strong>
          }
        >
          <Text>
            {_("The final step to configure the TPM to automatically open devices will take place during the first boot of the new system. For that to work, the machine needs to boot directly to the new boot loader. If a local media was used to run this installer, make sure is removed before next boot.")}
          </Text>
        </ExpandableSection>
      </HintBody>
    </Hint>
  );
};

const SuccessIcon = () => <Icon name="check_circle" className="icon-xxxl color-success" />;

function InstallationFinished() {
  const client = useInstallerClient();
  const [iguana, setIguana] = useState(false);
  const [tpm, setTpm] = useState(false);
  const closingAction = () => client.manager.finishInstallation();
  const buttonCaption = iguana
    // TRANSLATORS: button label
    ? _("Finish")
    // TRANSLATORS: button label
    : _("Reboot");

  useEffect(() => {
    async function getIguana() {
      const ret = await client.manager.useIguana();
      setIguana(ret);
    }

    // FIXME: This logic should likely not be placed here, it's too complex and too coupled to storage internals.
    // Something to fix when this whole page is refactored in a (hopefully near) future.
    async function getTpm() {
      const result = await client.storage.proposal.getResult();
      const method = result.settings.encryptionMethod;
      const tpmId = "tpm_fde";
      setTpm(method === tpmId);
    }

    getIguana();
    getTpm();
  });

  return (
    // TRANSLATORS: page title
    <Page icon="task_alt" title={_("Installation Finished")}>
      <Center>
        <EmptyState variant="xl">
          <EmptyStateHeader
            titleText={_("Congratulations!")}
            headingLevel="h2"
            icon={<EmptyStateIcon icon={SuccessIcon} />}
          />
          <EmptyStateBody>
            <Text>{_("The installation on your machine is complete.")}</Text>
            <Text>
              {
                iguana
                  ? _("At this point you can power off the machine.")
                  : _("At this point you can reboot the machine to log in to the new system.")
              }
            </Text>
            <If
              condition={tpm}
              then={<TpmHint />}
            />
          </EmptyStateBody>
        </EmptyState>
      </Center>

      <Page.Actions>
        <Page.Action onClick={closingAction}>{buttonCaption}</Page.Action>
      </Page.Actions>
    </Page>
  );
}

export default InstallationFinished;
