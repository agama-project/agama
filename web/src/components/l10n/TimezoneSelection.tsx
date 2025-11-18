/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { Content, Flex, Form, FormGroup, Radio } from "@patternfly/react-core";
import { useNavigate } from "react-router";
import { ListSearch, Page } from "~/components/core";
import { Timezone } from "~/api/l10n/system";
import { patchConfig } from "~/api";
import { useSystem, useProposal } from "~/hooks/api";
import { timezoneTime } from "~/utils";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import { _ } from "~/i18n";

type TimezoneWithDetails = Timezone & { details: string };

let date: Date;

const timezoneWithDetails = (timezone: Timezone): TimezoneWithDetails => {
  const offset = timezone.utcOffset;

  if (offset === undefined) return { ...timezone, details: timezone.id };

  const hours = Math.floor(offset / 60);
  const minutes = offset % 60;
  const hoursString = hours >= 0 ? `+${hours}` : `${hours}`;

  let utc = "UTC";
  if (minutes === 0) {
    utc += hoursString;
  } else {
    utc += `${hoursString}:${minutes}`;
  }

  return { ...timezone, details: `${timezone.id} ${utc}` };
};

const sortedTimezones = (timezones: Timezone[]) => {
  return timezones.sort((timezone1, timezone2) => {
    const timezoneText = (t: Timezone) => t.parts.join("").toLowerCase();
    return timezoneText(timezone1) > timezoneText(timezone2) ? 1 : -1;
  });
};

// TODO: Add documentation
// TODO: Evaluate if worth it extracting the selector
// TODO: Refactor timezones/extendedTimezones thingy
export default function TimezoneSelection() {
  date = new Date();
  const navigate = useNavigate();
  const {
    l10n: { timezones },
  } = useSystem({ suspense: true });
  const {
    l10n: { timezone: currentTimezone },
  } = useProposal({ suspense: true });

  const displayTimezones = timezones.map(timezoneWithDetails);
  const [selected, setSelected] = useState(currentTimezone);
  const [filteredTimezones, setFilteredTimezones] = useState(sortedTimezones(displayTimezones));

  const searchHelp = _("Filter by territory, time zone code or UTC offset");

  const onSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    patchConfig({ l10n: { timezone: selected } });
    navigate(-1);
  };

  let timezonesList = filteredTimezones.map(
    ({ id, country, details, parts }: TimezoneWithDetails) => {
      return (
        <Radio
          id={id}
          key={id}
          name="timezone"
          onChange={() => setSelected(id)}
          label={
            <Flex columnGap={{ default: "columnGapSm" }}>
              <Content isEditorial className={`${spacingStyles.m_0}`}>
                {parts.join("-")}
              </Content>
              <Content component="small">{country}</Content>
            </Flex>
          }
          description={
            <Flex columnGap={{ default: "columnGapSm" }}>
              <Content component="small">{timezoneTime(id, date) || ""}</Content>
              <Content>{details}</Content>
            </Flex>
          }
          value={id}
          isChecked={id === selected}
        />
      );
    },
  );

  if (timezonesList.length === 0) {
    timezonesList = [<b key="notfound">{_("None of the time zones match the filter.")}</b>];
  }

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_(" Timezone selection")}</Content>
        <ListSearch
          placeholder={searchHelp}
          elements={displayTimezones}
          onChange={setFilteredTimezones}
        />
      </Page.Header>

      <Page.Content>
        <Form id="timezoneSelection" onSubmit={onSubmit}>
          <FormGroup isStack>{timezonesList}</FormGroup>
        </Form>
      </Page.Content>

      <Page.Actions>
        <Page.Submit form="timezoneSelection">{_("Select")}</Page.Submit>
        <Page.Cancel />
      </Page.Actions>
    </Page>
  );
}
