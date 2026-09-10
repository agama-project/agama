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
import { DescriptionList, Flex, FlexItem } from "@patternfly/react-core";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import Link from "~/components/core/Link";
import MenuButton from "~/components/core/MenuButton";
import SettingValue from "~/components/core/SettingValue";
import Text from "~/components/core/Text";
import Icon, { IconProps } from "~/components/layout/Icon";
import { baseName } from "~/components/storage/utils";
import { STORAGE as PATHS } from "~/routes/paths";
import { EXPANDED, SETTINGS_TAB, SHEET, SHEET_TAB } from "~/components/storage/ui-state-params";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useReset } from "~/hooks/model/config/storage";
import { useClearSearchParams } from "~/hooks/use-search-param-state";
import { _, TranslatedString } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";

/**
 * Where the machine will start from, said as a value rather than as a setting.
 *
 * The mark says what the value says, so the pair can be recognized before it is
 * read: a decision the reader made by hand is not the automatic one, and a
 * machine set to start from nowhere is neither.
 */
function boot(config: ConfigModel.Config): { value: TranslatedString; icon: IconProps["name"] } {
  if (!config.boot?.configure) {
    // TRANSLATORS: what the installation will do about starting the machine:
    // nothing, because the reader has said so.
    return { value: _("Not configured"), icon: "block" };
  }

  if (configModel.boot.isDefault(config)) {
    // TRANSLATORS: what the installation will do about starting the machine:
    // work out which disk it needs by itself.
    return { value: _("Automatic"), icon: "rotate_auto" };
  }

  const device = configModel.boot.findDevice(config);

  return {
    value: device?.name
      ? (baseName(device.name) as TranslatedString)
      : // TRANSLATORS: said where the machine is set to start from a disk the
        // reader has yet to choose.
        _("No disk selected"),
    /* The same turning arrow without the A: a decision of the same kind, taken
       by hand rather than by the installer. */
    icon: "settings_backup_restore",
  };
}

/** The same, for what protects the data the installation writes. */
function encryption(config: ConfigModel.Config): {
  value: TranslatedString;
  icon: IconProps["name"];
} {
  if (!config.encryption) {
    // TRANSLATORS: what protects the data the installation writes: nothing.
    return { value: _("Not encrypted"), icon: "lock_open" };
  }

  return {
    value: config.encryption.tpm
      ? // TRANSLATORS: how the installation is encrypted, where the machine's
        // security chip releases the key at start-up.
        _("LUKS2 with TPM")
      : // TRANSLATORS: how the installation is encrypted.
        _("LUKS2"),
    icon: "lock",
  };
}

/**
 * The page's own line: what this page is for, and the two decisions that belong
 * to the installation rather than to any one device.
 *
 * Boot and encryption are read far more often than they are changed, so they
 * are set here as values with a way in rather than as controls: they sit above
 * what the page reports rather than inside it, because neither is about
 * anything the summary names. Their marks say what their values say, so the
 * pair can be told apart before it is read.
 *
 * Both lead to pages of their own, and always will. Every form in the installer
 * lives at a route of its own, and a form needs what a panel cannot give it:
 * somewhere to return to on cancel, an address that survives a reload, and a
 * guard when leaving with unsaved changes.
 *
 * The sentence names no technology. LVM is one of the things a reader may
 * structure devices into rather than the point of the page, and the list below
 * names it where it is there.
 */
export default function TopLine(): React.ReactNode {
  const config = useConfigModel();
  const reset = useReset();
  const clearSearchParams = useClearSearchParams();

  if (!config) return null;

  const { value: bootValue, icon: bootIcon } = boot(config);
  const { value: encryptionValue, icon: encryptionIcon } = encryption(config);

  const onReset = () => {
    reset();
    /* Everything the address says about how this page is being looked at. What
       it points at is about to stop existing. */
    clearSearchParams(EXPANDED, SETTINGS_TAB, SHEET, SHEET_TAB);
  };

  return (
    <Flex
      alignItems={{ default: "alignItemsCenter" }}
      justifyContent={{ default: "justifyContentSpaceBetween" }}
      gap={{ default: "gapMd" }}
      /* Wrapping rather than pinned on one line. A strip this crowded runs out
         of room before the window does, and a row that cannot wrap scrolls the
         page sideways instead. */
      flexWrap={{ default: "wrap" }}
    >
      <FlexItem>
        <Text textStyle={["fontSizeSm", "textColorSubtle"]}>
          {/* TRANSLATORS: says what the storage page is for, on its own line
              above what the page reports. */}
          {_("Choose devices to use and how to structure them")}
        </Text>
      </FlexItem>
      <FlexItem>
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapMd" }}
          flexWrap={{ default: "wrap" }}
        >
          <FlexItem>
            {/* Laid out as a row of pairs rather than as PatternFly's columns,
                which share out whatever width they are given: two settings and
                a sentence spread across a whole strip read as three things
                placed apart rather than as one line. */}
            <DescriptionList isCompact isHorizontal isFluid className="agm-top-line__settings">
              <SettingValue
                icon={bootIcon}
                // TRANSLATORS: names the setting saying where the machine will
                // start from once it is installed.
                term={_("Boot")}
                value={
                  <Link to={PATHS.editBootDevice} keepQuery variant="link" isInline>
                    {bootValue}
                  </Link>
                }
              />
              <SettingValue
                icon={encryptionIcon}
                // TRANSLATORS: names the setting saying what protects the data
                // the installation writes.
                term={_("Encryption")}
                value={
                  <Link to={PATHS.editEncryption} keepQuery variant="link" isInline>
                    {encryptionValue}
                  </Link>
                }
              />
            </DescriptionList>
          </FlexItem>
          <FlexItem>
            <MenuButton
              menuProps={{
                // TRANSLATORS: names the menu of things that can be done to the
                // whole storage configuration.
                "aria-label": _("Actions for this configuration"),
                popperProps: { position: "end" },
              }}
              toggleProps={{
                variant: "plain",
                className: spacingStyles.p_0,
                /* Three dots name nothing. Without this the toggle reaches a
                   screen reader as an unnamed button. */
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
