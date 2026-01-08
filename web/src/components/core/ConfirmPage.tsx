/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { Navigate } from "react-router";
import { Button, Content, Divider, Flex, Grid, GridItem, Stack } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import Text from "~/components/core/Text";
import Popup from "~/components/core/Popup";
import PotentialDataLossAlert from "~/components/storage/PotentialDataLossAlert";
import InstallationSummarySection from "~/components/overview/InstallationSummarySection";
import SystemInformationSection from "~/components/overview/SystemInformationSection";
import { startInstallation } from "~/model/manager";
import { useProductInfo } from "~/hooks/model/config/product";
import { PRODUCT } from "~/routes/paths";
import { useDestructiveActions } from "~/hooks/use-destructive-actions";
import { _ } from "~/i18n";

export default function ConfirmPage() {
  const product = useProductInfo();
  const { actions } = useDestructiveActions();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const hasDestructiveActions = actions.length > 0;

  if (!product) {
    return <Navigate to={PRODUCT.root} />;
  }

  const onInstallClick = () => {
    hasDestructiveActions ? setShowConfirmation(true) : startInstallation();
  };

  const onConfirm = () => {
    startInstallation();
    setShowConfirmation(false);
  };

  const onCancel = () => setShowConfirmation(false);

  const [buttonLocationStart, buttonLocationEnd] = _(
    "When ready, click on the %s button at te end of the page.",
  ).split("%s");

  return (
    <Page title={product.name}>
      <Page.Content>
        <Flex gap={{ default: "gapMd" }} direction={{ default: "column" }}>
          <div>
            <Content isEditorial>
              {
                // TRANSLATORS: Introductory text shown in the overview page
                // either, after selecting a product or before starting the
                // installation.
                _("Take a moment to review the installation settings and adjust them as needed.")
              }
            </Content>
            <Content>
              {buttonLocationStart} <strong>{_("install now")}</strong> {buttonLocationEnd}
            </Content>
          </div>
          <Divider />
          <PotentialDataLossAlert />
          <Grid hasGutter>
            <GridItem md={12} lg={6}>
              <InstallationSummarySection />
            </GridItem>
            <GridItem md={12} lg={6}>
              <SystemInformationSection />
            </GridItem>
          </Grid>
          <Flex>
            <Button
              size="lg"
              variant={hasDestructiveActions ? "danger" : "primary"}
              onClick={onInstallClick}
            >
              <Text isBold>
                {hasDestructiveActions
                  ? _("Install now with potential data loss")
                  : _("Install now")}
              </Text>
            </Button>
          </Flex>
        </Flex>
      </Page.Content>
      {showConfirmation && (
        <Popup isOpen title={_("Delete existing data and install?")}>
          <Stack hasGutter>
            <PotentialDataLossAlert
              isCompact
              hint={_("If unsure, cancel and review storage settings.")}
            />
          </Stack>
          <Popup.Actions>
            <Popup.DangerousAction onClick={onConfirm}>
              {_("Confirm and install")}
            </Popup.DangerousAction>
            <Popup.Cancel onClick={onCancel} />
          </Popup.Actions>
        </Popup>
      )}
    </Page>
  );
}
