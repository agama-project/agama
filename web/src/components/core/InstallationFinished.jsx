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
  Button,
  Text,
  EmptyState,
  EmptyStateBody,
  EmptyStateHeader,
  EmptyStateIcon,
} from "@patternfly/react-core";

import { Center, Icon, Title as SectionTitle, PageIcon, MainActions } from "~/components/layout";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";

const SuccessIcon = () => <Icon name="check_circle" className="icon-big color-success" />;

function InstallationFinished() {
  const client = useInstallerClient();
  const [iguana, setIguana] = useState(false);
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

    getIguana();
  });

  return (
    <Center>
      <SectionTitle>{_("Installation Finished")}</SectionTitle>
      <PageIcon><Icon name="task_alt" /></PageIcon>
      <MainActions>
        <Button size="lg" variant="primary" onClick={closingAction}>
          {buttonCaption}
        </Button>
      </MainActions>

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
          <Text>{_("Have a lot of fun! Your openSUSE Development Team.")}</Text>
        </EmptyStateBody>
      </EmptyState>
    </Center>
  );
}

export default InstallationFinished;
