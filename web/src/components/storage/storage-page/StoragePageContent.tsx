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
import { Grid, Stack, Tab, Tabs, TabTitleText } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import { NestedContent } from "~/components/core/";
import Icon from "~/components/layout/Icon";
import MenuButton from "~/components/core/MenuButton";
import Page from "~/components/layout/Page";
import ConfigEditor from "~/components/storage/ConfigEditor";
import EncryptionSection from "~/components/storage/EncryptionSection";
import BootSection from "~/components/storage/BootSection";
import FixableConfigInfo from "~/components/storage/FixableConfigInfo";
import ProposalFailedInfo from "~/components/storage/ProposalFailedInfo";
import UnsupportedModelInfo from "~/components/storage/UnsupportedModelInfo";
import ConfigurationSummary from "~/components/storage/storage-page/ConfigurationSummary";
import InvalidConfigMessage from "~/components/storage/storage-page/InvalidConfigMessage";
import NoDevicesMessage from "~/components/storage/storage-page/NoDevicesMessage";
import UnknownConfigMessage from "~/components/storage/storage-page/UnknownConfigMessage";
import ResultSheet from "~/components/storage/storage-page/ResultSheet";
import Sheet, { SheetPlacement } from "~/components/core/Sheet";
import { useSheet, SHEET_ID } from "~/components/storage/shared/use-sheet";
import { useMediaQuery } from "~/hooks/use-media-query";
import { useNoRoomReason } from "~/components/storage/storage-page/queries";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { useIssues } from "~/hooks/model/issue";
import { useReset } from "~/hooks/model/config/storage";
import { useProposal } from "~/hooks/model/proposal/storage";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useSearchParamState, useClearSearchParams } from "~/hooks/use-search-param-state";
import { EXPANDED, SETTINGS_TAB } from "~/components/storage/ui-state-params";
import { _ } from "~/i18n";

function ModelSection(): React.ReactNode {
  const [activeTab, setActiveTab] = useSearchParamState(SETTINGS_TAB, "0");
  const clearSearchParams = useClearSearchParams();
  const reset = useReset();
  const handleTabClick = (
    event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    tabIndex: number,
  ) => setActiveTab(tabIndex);

  const onReset = () => {
    reset();
    clearSearchParams(EXPANDED, SETTINGS_TAB);
  };

  return (
    <Page.Section
      isFullHeight
      title={_("Settings")}
      titleActions={
        <MenuButton
          menuProps={{
            popperProps: {
              position: "end",
            },
          }}
          toggleProps={{
            variant: "plain",
            className: spacingStyles.p_0,
          }}
          items={[
            <MenuButton.Item
              key="reset-link"
              onClick={onReset}
              description={_("Start from scratch with the default configuration")}
            >
              {_("Reset to defaults")}
            </MenuButton.Item>,
          ]}
        >
          <Icon name="more_horiz" className="agm-three-dots-icon" />
        </MenuButton>
      }
      description={_(
        "Changes in these settings will immediately update the 'Result' section below.",
      )}
    >
      <Tabs activeKey={activeTab} onSelect={handleTabClick} role="region">
        <Tab
          key="devices"
          eventKey={"0"}
          title={<TabTitleText>{_("Installation devices")}</TabTitleText>}
        >
          <NestedContent margin="mtSm">
            <Stack hasGutter>
              <div className={textStyles.textColorPlaceholder}>
                {_(
                  "Structure of the new system, including disks to use and additional devices like LVM volume groups.",
                )}
              </div>
              <ConfigEditor />
            </Stack>
          </NestedContent>
        </Tab>
        <Tab key="encryption" eventKey={"1"} title={<TabTitleText>{_("Encryption")}</TabTitleText>}>
          <NestedContent margin="mtSm">
            <EncryptionSection />
          </NestedContent>
        </Tab>
        <Tab key="system" eventKey={"2"} title={<TabTitleText>{_("Boot options")}</TabTitleText>}>
          <NestedContent margin="mtSm">
            <BootSection />
          </NestedContent>
        </Tab>
      </Tabs>
    </Page.Section>
  );
}

/** PatternFly's `lg`, where a panel over the page stops covering all of it. */
const LG = "(min-width: 62rem)";
/** PatternFly's `xl`, from where there is room for the page and a panel both. */
const XL = "(min-width: 75rem)";

/**
 * How much of the window the sheet takes, and what that leaves the page.
 *
 * Three bands rather than two. Below `lg` a panel drawn over the page covers
 * all of it anyway, so it takes its place instead. From there to `xl` it comes
 * over the page. At `xl` and above the two share the width and the page keeps
 * working.
 *
 * `xl` rather than a number of our own: 1024 falls between the two, and the
 * difference between a 1024 window and a 1199 one is not one this page behaves
 * differently at.
 */
function useSheetPlacement(): SheetPlacement {
  const fitsBoth = useMediaQuery(XL);
  const fitsOverlay = useMediaQuery(LG);

  if (fitsBoth) return "share";
  if (fitsOverlay) return "overlay";
  return "replace";
}

/**
 * What the storage page shows, and where everything it needs is read.
 *
 * The page has three states that replace it entirely, so they are picked before
 * anything else is arranged: no disk to install on, settings this interface
 * cannot read, and a configuration it knows nothing about.
 *
 * Everything else is the page, with the sheet the page opens over it. The sheet
 * wraps rather than sits beside, because two of its three placements are about
 * what the page does while it is open.
 *
 * @fixme The old settings section is still here. It goes as the parts replacing
 *  it arrive, so that the page works at every step.
 */
export default function StoragePageContent(): React.ReactNode {
  const model = useConfigModel();
  const availableDevices = useAvailableDevices();
  const proposal = useProposal();
  const issues = useIssues("storage");
  const noRoomReason = useNoRoomReason();
  const { subject, close } = useSheet();
  const placement = useSheetPlacement();

  const fixable = [
    "configNoRoot",
    "configMissingPaths",
    "configOverusedPvTarget",
    "configMisusedMdMember",
    "configMisusedPv",
    "proposal",
  ];
  const configIssues = issues.filter((i) => i.class !== "proposal");
  const unfixableIssues = issues.filter((i) => !fixable.includes(i.class));
  const isModelEditable = model && !unfixableIssues.length;

  if (!availableDevices.length) return <NoDevicesMessage />;
  if (configIssues.length && !isModelEditable)
    return <InvalidConfigMessage issues={configIssues} />;
  if (!configIssues.length && !model && !proposal) return <UnknownConfigMessage />;

  const body = (
    <Grid hasGutter>
      {/* The general account of a failed layout, which names the mount paths it
          could not place. Left out where the summary already says why, since
          the same failure told twice reads as two problems. */}
      {!configIssues.length && !proposal && !noRoomReason && <ProposalFailedInfo />}
      {!!configIssues.length && <FixableConfigInfo issues={configIssues} />}
      {!model && <UnsupportedModelInfo />}
      {model && <ConfigurationSummary />}
      {model && <ModelSection />}
    </Grid>
  );

  return (
    <Sheet
      id={SHEET_ID}
      isOpen={subject !== null}
      placement={placement}
      onClose={close}
      title={_("Result")}
      description={_("What the installer will do, and what the machine will look like")}
      page={body}
    >
      <ResultSheet />
    </Sheet>
  );
}
