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
import {
  Button,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  DataListAction,
  Flex,
  FormGroup,
  TextInput,
} from "@patternfly/react-core";

import { _ } from "~/i18n";

type DnsSearch = {
  id?: number;
  domain: string;
};

let index = 0;

export default function DnsSearchDataList({
  searchList: originalSearchList,
  updateDnsSearchList,
}: {
  searchList: DnsSearch[];
  updateDnsSearchList: (searchList: DnsSearch[]) => void;
}) {
  const searchList = originalSearchList.map((item: DnsSearch) => {
    if (!item.id) item.id = index++;
    return item;
  });

  const addDomain = () => {
    searchList.push({ domain: "", id: index++ });
    updateDnsSearchList(searchList);
  };

  const updateDomain = (id: number, value: string) => {
    const item = searchList.find((i) => i.id === id);
    if (item) {
      item.domain = value;
      updateDnsSearchList(searchList);
    }
  };

  const deleteDomain = (id: number) => {
    const itemIdx = searchList.findIndex((i) => i.id === id);
    searchList.splice(itemIdx, 1);
    updateDnsSearchList(searchList);
  };

  const renderDomain = ({ id, domain }: DnsSearch) => {
    return (
      <DataListItem key={`dns-search-${id}`}>
        <DataListItemRow>
          <DataListItemCells
            dataListCells={[
              <DataListCell key={`dns-search-${id}-domain`}>
                <TextInput
                  // TRANSLATORS: input field name
                  label={_("Domain")}
                  value={domain}
                  onChange={(_, value: string) => updateDomain(id!, value)}
                />
              </DataListCell>,
            ]}
          />
          {/** @ts-expect-error: https://github.com/patternfly/patternfly-react/issues/9823 */}
          <DataListAction id={`delete-dns-search-${id}`}>
            <Button
              size="sm"
              variant="link"
              className="remove-link"
              onClick={() => deleteDomain(id!)}
            >
              {/* TRANSLATORS: button label */}
              {_("Remove")}
            </Button>
          </DataListAction>
        </DataListItemRow>
      </DataListItem>
    );
  };

  // TRANSLATORS: button label
  const newDomainButtonText = searchList.length
    ? _("Add another search domain")
    : _("Add search domain");

  return (
    <FormGroup label={_("DNS Search List")}>
      <Flex
        direction={{ default: "column" }}
        alignItems={{ default: "alignItemsFlexStart" }}
        gap={{ default: "gapMd" }}
      >
        <DataList isCompact aria-label="DNS search list">
          {searchList.map((item) => renderDomain(item))}
        </DataList>
        <Button size="sm" variant="secondary" onClick={addDomain}>
          {newDomainButtonText}
        </Button>
      </Flex>
    </FormGroup>
  );
}
