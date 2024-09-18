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

// cspell:ignore wwpns

import React, { FormEvent, useEffect, useState } from "react";
import { Alert, Form, FormGroup, FormSelect, FormSelectOption } from "@patternfly/react-core";
import { AxiosResponseHeaders } from "axios";
import { Page } from "~/components/core";
import { useZFCPControllers, useZFCPDisks } from "~/queries/storage/zfcp";
import { inactiveLuns } from "~/utils/zfcp";
import { _ } from "~/i18n";

type FormData = {
  id?: string;
  channel?: string;
  wwpn?: string;
  lun?: string;
};

/**
 * Form for activating a zFCP disk.
 */
export default function ZFCPDiskForm({
  id,
  onSubmit,
  onLoading,
}: {
  id: string;
  onSubmit: (formData: FormData) => Promise<AxiosResponseHeaders>;
  onLoading: (isLoading: boolean) => void;
}) {
  const controllers = useZFCPControllers();
  const disks = useZFCPDisks();
  const luns = inactiveLuns(controllers, disks);

  const [formData, setFormData] = useState({} as FormData);
  const [isLoading, setIsLoading] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  useEffect(() => {
    onLoading(isLoading);
  }, [onLoading, isLoading]);

  const getChannels = () => {
    const channels = [...new Set(luns.map((l) => l.channel))];
    return channels.sort();
  };

  const getWWPNs = (channel: string) => {
    const selection = luns.filter((l) => l.channel === channel);
    const wwpns = [...new Set(selection.map((l) => l.wwpn))];
    return wwpns.sort();
  };

  const getLUNs = (channel: string, wwpn: string) => {
    const selection = luns.filter((l) => l.channel === channel && l.wwpn === wwpn);
    return selection.map((l) => l.lun).sort();
  };

  const select = (
    channel: string = undefined,
    wwpn: string = undefined,
    lun: string = undefined,
  ) => {
    if (!channel) channel = getChannels()[0];
    if (!wwpn) wwpn = getWWPNs(channel)[0];
    if (!lun) lun = getLUNs(channel, wwpn)[0];

    if (channel) setFormData({ channel, wwpn, lun });
  };

  const selectChannel = (_, channel: string) => select(channel);

  const selectWWPN = (_, wwpn: string) => select(formData.channel, wwpn);

  const selectLUN = (_, lun: string) => select(formData.channel, formData.wwpn, lun);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    setIsLoading(true);
    const controller = controllers.find((c) => c.channel === formData.channel);
    const result = await onSubmit({ id: controller.id, ...formData });
    setIsFailed(result.status !== 200);
    setIsLoading(false);
  };

  if (!formData.channel && getChannels().length > 0) select();

  return (
    <Page.Section aria-label="zfcp-activation-form">
      {isFailed && (
        <Alert variant="warning" isInline title={_("Something went wrong")}>
          <p>{_("The zFCP disk was not activated.")}</p>
        </Alert>
      )}
      <Form id={id} name="ZFCPDisk" onSubmit={submit}>
        <FormGroup fieldId="channelId" label={_("Channel ID")}>
          <FormSelect
            id="channelId"
            value={formData.channel}
            onChange={selectChannel}
            isDisabled={isLoading}
          >
            {getChannels().map((channel, i) => (
              <FormSelectOption key={i} value={channel} label={channel} />
            ))}
          </FormSelect>
        </FormGroup>
        {/* TRANSLATORS: abbrev. World Wide Port Name */}
        <FormGroup fieldId="wwpn" label={_("WWPN")}>
          <FormSelect id="wwpn" value={formData.wwpn} onChange={selectWWPN} isDisabled={isLoading}>
            {getWWPNs(formData.channel).map((wwpn, i) => (
              <FormSelectOption key={i} value={wwpn} label={wwpn} />
            ))}
          </FormSelect>
        </FormGroup>
        {/* TRANSLATORS: abbrev. Logical Unit Number */}
        <FormGroup fieldId="lun" label={_("LUN")}>
          <FormSelect id="lun" value={formData.lun} onChange={selectLUN} isDisabled={isLoading}>
            {getLUNs(formData.channel, formData.wwpn).map((lun, i) => (
              <FormSelectOption key={i} value={lun} label={lun} />
            ))}
          </FormSelect>
        </FormGroup>
      </Form>
    </Page.Section>
  );
}
