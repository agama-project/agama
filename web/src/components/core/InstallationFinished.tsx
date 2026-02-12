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
  Button,
  Content,
  Divider,
  Flex,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Stack,
  Title,
} from "@patternfly/react-core";
import { useNavigate } from "react-router";
import Icon from "~/components/layout/Icon";
import Page from "~/components/core/Page";
import { useExtendedConfig } from "~/hooks/model/config";
import { finishInstallation } from "~/api";
import { ROOT as PATHS } from "~/routes/paths";
import { _ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import alignmentStyles from "@patternfly/react-styles/css/utilities/Alignment/alignment";

const TpmAlert = () => {
  const title = _("TPM sealing requires the new system to be booted directly.");

  return (
    <Alert title={title} variant="danger">
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

// TODO: define some utility method to get the device used as root (drive, partition, logical volume).
// TODO: use type checking for config.
function usingTpm(config): boolean {
  if (!config) {
    return null;
  }

  if (config.guided) return config.guided.encryption;

  const { drives = [], volumeGroups = [] } = config;

  const devices = [
    ...drives,
    ...drives.flatMap((d) => d.partitions || []),
    ...volumeGroups.flatMap((v) => v.logicalVolumes || []),
  ];

  const root = devices.find((d) => d.filesystem?.path === "/");

  return root?.encryption?.tpmFde !== undefined;
}

const RebootButton = () => {
  const navigate = useNavigate();

  const onReboot = () => {
    finishInstallation();
    navigate(PATHS.installationExit, { replace: true });
  };

  return (
    <Button variant="primary" size="lg" style={{ minInlineSize: "25dvw" }} onClick={onReboot}>
      {_("Reboot")}
    </Button>
  );
};

function InstallationFinished() {
  const { storage: storageConfig } = useExtendedConfig();
  const mountTpmAlert = usingTpm(storageConfig);

  return (
    <Page variant="minimal">
      <Page.Content>
        <Grid hasGutter style={{ height: "100%", placeContent: "center" }}>
          <GridItem sm={12} md={6} style={{ alignSelf: "center" }}>
            <Flex
              gap={{ default: "gapMd" }}
              direction={{ default: "column" }}
              alignItems={{ default: "alignItemsCenter", md: "alignItemsFlexEnd" }}
              alignContent={{ default: "alignContentCenter", md: "alignContentFlexEnd" }}
              alignSelf={{ default: "alignSelfCenter" }}
            >
              <Icon name="done_all" width="3rem" height="3rem" />
              <Title
                headingLevel="h1"
                style={{ textWrap: "balance" }}
                className={[textStyles.fontSize_3xl, alignmentStyles.textAlignEndOnMd].join(" ")}
              >
                {_("Installation complete")}
              </Title>

              <HelperText>
                <HelperTextItem
                  className={alignmentStyles.textAlignEnd}
                  style={{ textWrap: "balance" }}
                >
                  {_("You can reboot the machine to log in to the new system.")}
                </HelperTextItem>
              </HelperText>
              {mountTpmAlert && <RebootButton />}
            </Flex>
          </GridItem>
          <GridItem sm={12} md={6}>
            <Flex
              gap={{ default: "gapMd" }}
              alignItems={{ md: "alignItemsCenter" }}
              justifyContent={{ default: "justifyContentCenter", md: "justifyContentFlexStart" }}
              style={{
                minBlockSize: "30dvh",
                boxShadow: "-1px 0 0 var(--pf-t--global--border--color--default)",
                paddingInlineStart: "var(--pf-t--global--spacer--md)",
                marginBlockStart: "var(--pf-t--global--spacer--xl)",
              }}
            >
              {mountTpmAlert ? <TpmAlert /> : <RebootButton />}
            </Flex>
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}

export default InstallationFinished;
