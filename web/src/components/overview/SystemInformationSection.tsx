import React from "react";
import xbytes from "xbytes";
import Page from "~/components/core/Page";
import NestedContent from "~/components/core/NestedContent";
import Details from "~/components/core/Details";
import FormattedIPsList from "~/components/network/FormattedIpsList";
import { useSystem } from "~/hooks/model/system";
import { _ } from "~/i18n";

export default function SystemInformationSection() {
  const { hardware } = useSystem();

  return (
    <Page.Section title={_("System information")}>
      <NestedContent margin="mMd">
        <Details isHorizontal isCompact>
          <Details.Item label={_("Model")}>{hardware.model}</Details.Item>
          <Details.Item label={_("CPU")}>{hardware.cpu}</Details.Item>
          <Details.Item label={_("Memory")}>
            {hardware.memory ? xbytes(hardware.memory, { iec: true }) : undefined}
          </Details.Item>
          <Details.Item label={_("IPs")}>
            <FormattedIPsList />
          </Details.Item>
        </Details>
      </NestedContent>
    </Page.Section>
  );
}
