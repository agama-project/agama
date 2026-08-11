/*
 * Copyright (c) [2022-2026] SUSE LLC
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

import React from "react";
import {
  Alert,
  Content,
  Divider,
  Flex,
  HelperText,
  HelperTextItem,
  Stack,
} from "@patternfly/react-core";
import Page from "~/components/core/Page";
import RebootButton from "~/components/core/RebootButton";
import SideBySideLayout from "~/components/layout/SideBySideLayout";
import { useIsGrub2WithTpm } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

const TpmAlert = () => {
  const title = _("TPM sealing requires the new system to be booted directly.");

  return (
    <Alert isInline title={title} variant="danger">
      <Stack hasGutter>
        <Divider />
        <Content isEditorial className={textStyles.fontSizeXl}>
          {_("If a local media was used to run this installer, remove it before the next boot.")}
        </Content>
        <Divider />
        <Content>
          {
            // TRANSLATORS: "Trusted Platform Module" is the name of the technology and "TPM" its abbreviation
            _(
              "The final step to configure the Trusted Platform Module (TPM) to automatically \
open encrypted devices will take place during the first boot of the new system. For that to work, \
the machine needs to boot directly to the new boot loader.",
            )
          }
        </Content>
      </Stack>
    </Alert>
  );
};

function InstallationFinished() {
  const isGrub2WithTpm = useIsGrub2WithTpm();
  const rebootHint = _("You can reboot the machine to log in to the new system.");

  return (
    <Page noDefaultProgressMonitor>
      <Page.Content>
        <SideBySideLayout
          icon="done_all"
          title={_("Installation complete")}
          description={
            isGrub2WithTpm && (
              <HelperText>
                <HelperTextItem>{rebootHint}</HelperTextItem>
              </HelperText>
            )
          }
        >
          {isGrub2WithTpm ? (
            <Stack hasGutter>
              <TpmAlert />
              <RebootButton size="default" />
            </Stack>
          ) : (
            <Flex
              direction={{ default: "column" }}
              alignItems={{ default: "alignItemsFlexStart" }}
              gap={{ default: "gapMd" }}
            >
              <Content>{rebootHint}</Content>
              <RebootButton size="default" />
            </Flex>
          )}
        </SideBySideLayout>
      </Page.Content>
    </Page>
  );
}

export default InstallationFinished;
