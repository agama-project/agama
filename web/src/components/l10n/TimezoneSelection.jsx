/*
 * Copyright (c) [2023-2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { Divider, Flex, Form, FormGroup, Radio, Text } from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { ListSearch, Page } from "~/components/core";
import { _ } from "~/i18n";
import { timezoneTime } from "~/utils";
import { useConfigMutation, useL10n } from "~/queries/l10n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

let date;

const timezoneWithDetails = (timezone) => {
  const offset = timezone.utcOffset;

  if (offset === undefined) return { ...timezone, details: timezone.id };

  let utc = "UTC";
  if (offset > 0) utc += `+${offset}`;
  if (offset < 0) utc += `${offset}`;

  return { ...timezone, details: `${timezone.id} ${utc}` };
};

const sortedTimezones = (timezones) => {
  return timezones.sort((timezone1, timezone2) => {
    const timezoneText = (t) => t.parts.join("").toLowerCase();
    return timezoneText(timezone1) > timezoneText(timezone2) ? 1 : -1;
  });
};

// TODO: Add documentation and typechecking
// TODO: Evaluate if worth it extracting the selector
// TODO: Refactor timezones/extendedTimezones thingy
export default function TimezoneSelection() {
  date = new Date();
  const navigate = useNavigate();
  const setConfig = useConfigMutation();
  const { timezones, selectedTimezone: currentTimezone } = useL10n();
  const displayTimezones = timezones.map(timezoneWithDetails);
  const [selected, setSelected] = useState(currentTimezone.id);
  const [filteredTimezones, setFilteredTimezones] = useState(sortedTimezones(displayTimezones));

  const searchHelp = _("Filter by territory, time zone code or UTC offset");

  const onSubmit = async (e) => {
    e.preventDefault();
    setConfig.mutate({ timezone: selected });
    navigate(-1);
  };

  let timezonesList = filteredTimezones.map(({ id, country, details, parts }) => {
    return (
      <Radio
        id={id}
        key={id}
        name="timezone"
        onChange={() => setSelected(id)}
        label={
          <>
            <span className={`${textStyles.fontSizeLg}`}>
              <b>{parts.join("-")}</b>
            </span>{" "}
            <Text component="small">{country}</Text>
          </>
        }
        description={
          <Flex columnGap={{ default: "columnGapXs" }}>
            <Text component="small">{timezoneTime(id, { date }) || ""}</Text>
            <Divider orientation={{ default: "vertical" }} />
            <div>{details}</div>
          </Flex>
        }
        value={id}
        isChecked={id === selected}
      />
    );
  });

  if (timezonesList.length === 0) {
    timezonesList = <b>{_("None of the time zones match the filter.")}</b>;
  }

  return (
    <Page>
      <Page.Header>
        <h2>{_(" Timezone selection")}</h2>
        <ListSearch
          placeholder={searchHelp}
          elements={displayTimezones}
          onChange={setFilteredTimezones}
        />
      </Page.Header>

      <Page.MainContent>
        <Page.CardSection>
          <Form id="timezoneSelection" onSubmit={onSubmit}>
            <FormGroup isStack>{timezonesList}</FormGroup>
          </Form>
        </Page.CardSection>
      </Page.MainContent>
      <Page.NextActions>
        <Page.CancelAction />
        <Page.Action type="submit" form="timezoneSelection">
          {_("Select")}
        </Page.Action>
      </Page.NextActions>
    </Page>
  );
}
