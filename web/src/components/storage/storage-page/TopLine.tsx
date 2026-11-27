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

import React from "react";
import { Flex, FlexItem } from "@patternfly/react-core";
import FixableConfigInfo from "~/components/storage/FixableConfigInfo";
import ProposalFailedInfo from "~/components/storage/ProposalFailedInfo";
import { useIssues } from "~/hooks/model/issue";
import Interpolate from "~/components/core/Interpolate";
import Link from "~/components/core/Link";
import MenuButton from "~/components/core/MenuButton";
import Text from "~/components/core/Text";
import Icon, { IconProps } from "~/components/layout/Icon";
import TruncatedDeviceName from "~/components/storage/TruncatedDeviceName";
import { bootIcon } from "~/components/storage/shared/boot";
import { STORAGE as PATHS } from "~/routes/paths";
import { EXPANDED, DEVICE_DETAILS } from "~/components/storage/ui-state-params";
import configModel from "~/model/storage/config-model";
import Summary from "~/components/storage/storage-page/Summary";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useProposal } from "~/hooks/model/proposal/storage";
import { useReset } from "~/hooks/model/config/storage";
import { useClearSearchParams } from "~/hooks/use-search-param-state";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";

/** Renders a setting value in bold. */
const bold = (text: string) => <Text isBold>{text}</Text>;

/** A setting phrase, its part in square brackets in bold. */
const phrase = (sentence: string) => <Interpolate sentence={sentence}>{bold}</Interpolate>;

/** The boot setting, as a phrase and its icon. */
function boot(config: ConfigModel.Config): { value: React.ReactNode; icon: IconProps["name"] } {
  if (!config.boot?.configure) {
    // TRANSLATORS: no disk is set up to boot the system. Text in square brackets is shown in bold.
    return { value: phrase(_("Boot disk: [not configured]")), icon: bootIcon(config) };
  }

  if (configModel.boot.isDefault(config)) {
    // TRANSLATORS: the installer picks the boot disk. Text in square brackets is shown in bold.
    return { value: phrase(_("Boot disk: [auto]")), icon: bootIcon(config) };
  }

  const device = configModel.boot.findDevice(config);

  return {
    value: device?.name ? (
      /* Long names are shortened, with the full one in a tooltip. */
      <Interpolate
        // TRANSLATORS: %s is the name of the boot disk, such as "sda"
        sentence={_("Boot disk: %s")}
      >
        {() => (
          <Text isBold>
            <TruncatedDeviceName device={device} />
          </Text>
        )}
      </Interpolate>
    ) : (
      phrase(
        // TRANSLATORS: a boot disk is required but not chosen yet. Text in square brackets is shown
        // in bold.
        _("Boot disk: [not selected]"),
      )
    ),
    icon: bootIcon(config),
  };
}

/** The encryption setting, as a phrase and its icon. */
function encryption(config: ConfigModel.Config): {
  value: React.ReactNode;
  icon: IconProps["name"];
} {
  if (!config.encryption) {
    // TRANSLATORS: the installation is not encrypted. Text in square brackets is shown in bold.
    return { value: phrase(_("Encryption: [none]")), icon: "lock_open" };
  }

  return {
    value: phrase(
      config.encryption.tpm
        ? // TRANSLATORS: TPM is the security chip releasing the key at boot. Text in square
          // brackets is shown in bold.
          _("Encryption: [LUKS2 with TPM]")
        : // TRANSLATORS: text in square brackets is shown in bold
          _("Encryption: [LUKS2]"),
    ),
    icon: "lock",
  };
}

/**
 * The line under the page title: what the page is for, the boot and encryption
 * settings of the whole installation, and the actions on the configuration.
 *
 * Boot and encryption are read more often than changed, so they are links to
 * their own pages rather than controls.
 */
export default function TopLine(): React.ReactNode {
  const config = useConfigModel();
  const reset = useReset();
  const clearSearchParams = useClearSearchParams();

  if (!config) return null;

  const { value: bootValue, icon: bootMark } = boot(config);
  const { value: encryptionValue, icon: encryptionIcon } = encryption(config);

  const onReset = () => {
    reset();
    /* The view state in the address points at things the reset removes. */
    clearSearchParams(EXPANDED, DEVICE_DETAILS);
  };

  const description = (
    <FlexItem component="p">
      <Text textStyle={["fontSizeSm", "textColorSubtle"]}>
        {_("Configure which storage devices will be used to install and how")}
      </Text>
    </FlexItem>
  );

  return (
    <Flex
      alignItems={{ default: "alignItemsCenter" }}
      justifyContent={{ default: "justifyContentSpaceBetween" }}
      gap={{ default: "gapMd" }}
      flexWrap={{ default: "wrap" }}
    >
      {description}
      {/* At the end of the line, also when wrapped. */}
      <FlexItem align={{ default: "alignRight" }}>
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapMd" }}
          flexWrap={{ default: "wrap" }}
        >
          <FlexItem>
            <ul className="agm-top-line__settings">
              <li>
                <Icon name={bootMark} aria-hidden />
                <Link to={PATHS.editBootDevice} keepQuery variant="link" isInline>
                  {bootValue}
                </Link>
              </li>
              <li>
                <Icon name={encryptionIcon} aria-hidden />
                <Link to={PATHS.editEncryption} keepQuery variant="link" isInline>
                  {encryptionValue}
                </Link>
              </li>
            </ul>
          </FlexItem>
          <FlexItem>
            <MenuButton
              menuProps={{
                "aria-label": _("Actions for this configuration"),
                popperProps: { position: "end" },
              }}
              toggleProps={{
                variant: "plain",
                "aria-label": _("Actions for this configuration"),
              }}
              items={[
                <MenuButton.Item
                  key="reset"
                  onClick={onReset}
                  description={_("Start from scratch with the default configuration")}
                >
                  {_("Reset to defaults")}
                </MenuButton.Item>,
              ]}
            >
              <Icon name="more_horiz" className="agm-three-dots-icon" />
            </MenuButton>
          </FlexItem>
        </Flex>
      </FlexItem>
    </Flex>
  );
}

/**
 * The result at the top of the storage page: the summary of the planned
 * changes, or the problem preventing them.
 */
export function TopResult(): React.ReactNode {
  const proposal = useProposal();
  const issues = useIssues("storage");
  const configIssues = issues.filter((i) => i.class !== "proposal");

  if (proposal) return <Summary />;

  return configIssues.length ? <FixableConfigInfo issues={configIssues} /> : <ProposalFailedInfo />;
}
