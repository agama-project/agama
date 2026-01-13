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
import {
  Button,
  Content,
  Divider,
  Flex,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import Page from "~/components/core/Page";
import Text from "~/components/core/Text";
import Popup from "~/components/core/Popup";
import PotentialDataLossAlert from "~/components/storage/PotentialDataLossAlert";
import InstallationSettings from "~/components/overview/InstallationSettings";
import SystemInformationSection from "~/components/overview/SystemInformationSection";
import ProductLogo from "~/components/product/ProductLogo";
import { startInstallation } from "~/model/manager";
import { useProductInfo } from "~/hooks/model/config/product";
import { useIssues } from "~/hooks/model/issue";
import { PRODUCT } from "~/routes/paths";
import { useDestructiveActions } from "~/hooks/use-destructive-actions";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

import type { Product } from "~/types/software";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { useProgress } from "~/hooks/use-progress-tracking";

type ConfirmationPopupProps = {
  product: Product;
  isDangerous: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};
const ConfirmationPopup = ({
  product,
  isDangerous,
  onCancel,
  onConfirm,
}: ConfirmationPopupProps) => {
  const title = sprintf(
    // TRANSLATORS: Confirmation dialog title. %s is replaced with the product name (e.g., "openSUSE Leap")
    isDangerous ? _("Delete existing data and install %s?") : _("Install %s?"),
    product.name,
  );

  const ConfirmButton = isDangerous ? Popup.DangerousAction : Popup.Confirm;

  return (
    <Popup isOpen title={title}>
      {isDangerous ? (
        // TRANSLATORS: Warning shown when installation will delete existing data
        <PotentialDataLossAlert hint={_("If unsure, cancel and review storage settings.")} />
      ) : (
        <Content isEditorial>
          {/* TRANSLATORS: Information message confirming installation will proceed with current settings */}
          {_("By proceeding, the installation will begin with defined settings.")}
        </Content>
      )}
      <Popup.Actions>
        {/* TRANSLATORS: Button to confirm and start the installation */}
        <ConfirmButton onClick={onConfirm}>{_("Confirm and install")}</ConfirmButton>
        <Popup.Cancel onClick={onCancel} autoFocus />
      </Popup.Actions>
    </Popup>
  );
};

export default function OverviewPage() {
  const product = useProductInfo();
  const issues = useIssues();
  const progresses = useProgress();
  const { actions } = useDestructiveActions();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const hasIssues = !isEmpty(issues);
  const hasDestructiveActions = actions.length > 0;

  if (!product) {
    return <Navigate to={PRODUCT.root} />;
  }

  const [buttonLocationStart, buttonLocationLabel, buttonLocationEnd] = _(
    // TRANSLATORS: This hint helps users locate the install button. Text inside
    // square brackets [] appears in bold. Keep brackets for proper formatting.
    "When ready, click on the [install] button at the end of the page.",
  ).split(/[[\]]/);

  const onInstallClick = () => {
    setShowConfirmation(true);
  };

  const onConfirm = () => {
    startInstallation();
    setShowConfirmation(false);
  };

  const onCancel = () => setShowConfirmation(false);

  const isProposalReady = isEmpty(progresses);

  const getInstallButtonText = () => {
    if (hasIssues || !isProposalReady) return _("Install");
    if (hasDestructiveActions) return _("Install now with potential data loss");
    return _("Install now");
  };

  return (
    <Page
      title={
        <>
          <ProductLogo product={product} width="40px" /> {product.name}
        </>
      }
      showInstallerOptions
    >
      <Page.Content>
        <Flex gap={{ default: "gapMd" }} direction={{ default: "column" }}>
          <div>
            <Content isEditorial>
              {
                // TRANSLATORS: Introductory text shown on the overview page
                _("Take a moment to review the installation settings and adjust them as needed.")
              }
            </Content>
            <Content className={textStyles.textColorSubtle}>
              {buttonLocationStart} <strong>{buttonLocationLabel}</strong> {buttonLocationEnd}
            </Content>
          </div>
          <Divider />
          <Grid hasGutter>
            <GridItem sm={12} md={8}>
              <InstallationSettings />
            </GridItem>
            <GridItem sm={12} md={4}>
              <SystemInformationSection />
            </GridItem>
          </Grid>
          <Flex direction={{ default: "column" }} alignItems={{ default: "alignItemsFlexStart" }}>
            <Button
              size="lg"
              variant={hasDestructiveActions ? "danger" : "primary"}
              onClick={onInstallClick}
              isDisabled={hasIssues || !isProposalReady}
            >
              <Text isBold>{getInstallButtonText()}</Text>
            </Button>

            {!isProposalReady && (
              <HelperText>
                <HelperTextItem variant="warning">
                  {_("Installation will be available when the current operation completes.")}
                </HelperTextItem>
              </HelperText>
            )}

            {hasIssues && isProposalReady && (
              <HelperText>
                <HelperTextItem variant="warning">
                  {_("Fix areas with issues before proceeding with installation.")}
                </HelperTextItem>
              </HelperText>
            )}
          </Flex>
        </Flex>
      </Page.Content>
      {showConfirmation && (
        <ConfirmationPopup
          product={product}
          isDangerous={hasDestructiveActions}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </Page>
  );
}
