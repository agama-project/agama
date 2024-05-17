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

import React, { useEffect, useState } from "react";
import {
  Divider,
  Flex,
  Form, FormGroup,
  Radio,
  Stack,
  Text
} from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { _ } from "~/i18n";
import { timezoneTime } from "~/utils";
import { useL10n } from "~/context/l10n";
import { useInstallerClient } from "~/context/installer";
import { ListSearch, Page } from "~/components/core";
import textStyles from '@patternfly/react-styles/css/utilities/Text/text';

let date;

const timezoneWithDetails = (timezone) => {
  const offset = timezone.utcOffset;

  if (offset === undefined) return timezone.id;

  let utc = "UTC";
  if (offset > 0) utc += `+${offset}`;
  if (offset < 0) utc += `${offset}`;

  return { ...timezone, details: `${timezone.id} ${utc}` };
};

const sortedTimezones = (timezones) => {
  return timezones.sort((timezone1, timezone2) => {
    const timezoneText = t => t.parts.join('').toLowerCase();
    return timezoneText(timezone1) > timezoneText(timezone2) ? 1 : -1;
  });
};

// TODO: Add documentation and typechecking
// TODO: Evaluate if worth it extracting the selector
// TODO: Refactor timezones/extendedTimezones thingy
export default function TimezoneSelection() {
  date = new Date();
  const { l10n } = useInstallerClient();
  const { timezones, selectedTimezone: currentTimezone } = useL10n();
  const [displayTimezones, setDisplayTimezones] = useState([]);
  const [selected, setSelected] = useState(currentTimezone);
  const [filteredTimezones, setFilteredTimezones] = useState([]);
  const navigate = useNavigate();

  const searchHelp = _("Filter by territory, time zone code or UTC offset");

  useEffect(() => {
    setDisplayTimezones(timezones.map(timezoneWithDetails));
  }, [setDisplayTimezones, timezones]);

  useEffect(() => {
    setFilteredTimezones(sortedTimezones(displayTimezones));
  }, [setFilteredTimezones, displayTimezones]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const dataForm = new FormData(e.target);
    const nextTimezoneId = JSON.parse(dataForm.get("timezone"))?.id;

    if (nextTimezoneId !== currentTimezone?.id) {
      await l10n.setTimezone(nextTimezoneId);
    }

    navigate("..");
  };

  return (
    <>
      <Page.MainContent>
        <Stack hasGutter>
          <ListSearch placeholder={searchHelp} elements={displayTimezones} onChange={setFilteredTimezones} />
          <Form id="timezoneSelection" onSubmit={onSubmit}>
            <FormGroup isStack>
              {filteredTimezones.map((timezone) => (
                <Radio
                  key={timezone.id}
                  name="timezone"
                  id={timezone.id}
                  onChange={() => setSelected(timezone)}
                  label={
                    <>
                      <span className={`${textStyles.fontSizeLg}`}>
                        <b>{timezone.parts.join('-')}</b>
                      </span> <Text component="small">{timezone.country}</Text>
                    </>
                  }
                  description={
                    <Flex columnGap={{ default: "columnGapXs" }}>
                      <Text component="small">{timezoneTime(timezone.id, { date }) || ""}</Text>
                      <Divider orientation={{ default: "vertical" }} />
                      <div>{timezone.details}</div>
                    </Flex>
                  }
                  value={JSON.stringify(timezone)}
                  defaultChecked={timezone === selected}
                />
              ))}
            </FormGroup>
          </Form>
        </Stack>
      </Page.MainContent>
      <Page.NextActions>
        <Page.CancelAction />
        <Page.Action type="submit" form="timezoneSelection">
          {_("Select")}
        </Page.Action>
      </Page.NextActions>
    </>
  );
}
