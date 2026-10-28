/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useDeferredValue, useState } from "react";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Button,
  Content,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
  Stack,
} from "@patternfly/react-core";
import Popup from "~/components/core/Popup";
import Text from "~/components/core/Text";
import NoDesktopAlert from "~/components/software/NoDesktopAlert";
import PotentialDataLossAlert from "~/components/storage/PotentialDataLossAlert";
import { startInstallation } from "~/api";
import { useIssues } from "~/hooks/model/issue";
import { useIsDesktopMissing } from "~/hooks/model/system/software";
import { useDestructiveActions } from "~/hooks/use-destructive-actions";
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { _ } from "~/i18n";

import type { Product } from "~/model/system";

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
  const isDesktopMissing = useIsDesktopMissing();
  const title = sprintf(
    // TRANSLATORS: Confirmation dialog title. %s is replaced with the product name (e.g., "openSUSE Leap")
    isDangerous ? _("Delete existing data and install %s?") : _("Install %s?"),
    product.name,
  );

  const ConfirmButton = isDangerous ? Popup.DangerousAction : Popup.Confirm;

  return (
    <Popup
      isOpen
      title={title}
      onClose={onCancel}
      actions={
        <>
          {/* TRANSLATORS: Button to confirm and start the installation */}
          <ConfirmButton onClick={onConfirm}>{_("Confirm and install")}</ConfirmButton>
          <Popup.Cancel onClick={onCancel} autoFocus />
        </>
      }
    >
      <Stack hasGutter>
        <Content isEditorial>
          {/* TRANSLATORS: shown at the top of the install confirmation dialog. */}
          {_("Confirming starts the installation immediately with the defined settings.")}
        </Content>
        {isDesktopMissing && <NoDesktopAlert />}
        {isDangerous && <PotentialDataLossAlert />}
      </Stack>
    </Popup>
  );
};

export type InstallButtonProps = {
  /** Product that will be installed, needed to confirm the action. */
  product: Product;
};

/**
 * Button that starts the installation of the given product, after asking for
 * confirmation.
 *
 * The button warns about a destructive installation and stays disabled while
 * there are pending operations or settings to fix, explaining why below it.
 *
 * @example
 * <InstallButton product={product} />
 */
export default function InstallButton({ product }: InstallButtonProps) {
  const issues = useIssues();
  const { loading } = useProgressTracking();
  const { actions } = useDestructiveActions();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const isReady = useDeferredValue(!loading);
  const hasIssues = !isEmpty(issues);
  const hasDestructiveActions = actions.length > 0;

  const onConfirm = () => {
    startInstallation();
    setShowConfirmation(false);
  };

  const text = () => {
    if (hasIssues || !isReady) return _("Install");
    if (hasDestructiveActions) return _("Install now with potential data loss");
    return _("Install now");
  };

  return (
    <Flex direction={{ default: "column" }} alignItems={{ default: "alignItemsFlexStart" }}>
      <FlexItem grow={{ default: "grow" }} />
      <FlexItem>
        <Button
          size="lg"
          variant={hasDestructiveActions ? "danger" : "primary"}
          onClick={() => setShowConfirmation(true)}
          isDisabled={hasIssues || !isReady}
        >
          <Text isBold>{text()}</Text>
        </Button>
      </FlexItem>

      {!isReady && (
        <FlexItem>
          <HelperText>
            <HelperTextItem variant="indeterminate">
              {_("Wait until current operations are completed.")}
            </HelperTextItem>
          </HelperText>
        </FlexItem>
      )}

      {hasIssues && isReady && (
        <FlexItem>
          <HelperText>
            <HelperTextItem variant="warning">
              {_("Fix invalid settings before starting the installation.")}
            </HelperTextItem>
          </HelperText>
        </FlexItem>
      )}

      {showConfirmation && (
        <ConfirmationPopup
          product={product}
          isDangerous={hasDestructiveActions}
          onConfirm={onConfirm}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </Flex>
  );
}
