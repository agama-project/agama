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

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Button,
  Form,
  FormGroup,
  ActionGroup,
  EmptyState,
  EmptyStateBody,
  Checkbox,
} from "@patternfly/react-core";
import { Page } from "~/components/core";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";
import { useCheckLunScan, useControllers, useSystem } from "~/hooks/model/system/zfcp";
import { useConfig, useSetControllers } from "~/hooks/model/config/zfcp";
import Text from "~/components/core/Text";
import type { ZFCP as System } from "~/model/system";
import { isEmpty } from "radashi";

/**
 * Renders a PatternFly `EmptyState` block used when no zFCP controllers are detected on the host
 * machine.
 */
const NoControllersAvailable = (): React.ReactNode => {
  return (
    <EmptyState headingLevel="h2" titleText={_("No controllers available")} variant="sm">
      <EmptyStateBody>{_("There are not zFCP controllers pending of activation.")}</EmptyStateBody>
    </EmptyState>
  );
};

/**
 * Renders a PatternFly `Alert` to indicate the status of the LUN scan configuration.
 */
const LUNScanInfo = (): React.ReactNode => {
  const system = useSystem();

  const lunScanEnabled = [
    _("Automatic LUN scan is enabled"),
    _(
      "Activating a controller which is running in NPIV mode will automatically configures all its LUNs.",
    ),
  ];

  const lunScanDisabled = [
    _("Automatic LUN scan is disabled"),
    _("LUNs have to be manually configured after activating a controller."),
  ];

  const [title, message] = system?.lunScan ? lunScanEnabled : lunScanDisabled;

  return (
    <Alert variant="custom" title={title}>
      {message}
    </Alert>
  );
};

type ControllerOptionLabelProps = {
  controller: System.Controller;
};

/**
 * Label to show in the form for a controller.
 */
const ControllerOptionLabel = ({ controller }: ControllerOptionLabelProps): React.ReactNode => {
  const checkLunScan = useCheckLunScan();

  return checkLunScan(controller.channel) ? _("Performs auto LUN scan") : null;
};

/**
 * Form for activating zFCP controllers.
 */
const ZFCPControllersForm = (): React.ReactNode => {
  const controllers = useControllers();
  const config = useConfig();
  const setControllers = useSetControllers();
  const [selectedControllers, setSelectedControllers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setSelectedControllers(config?.controllers || []);
  }, [config]);

  const toggleController = (channel: string) => {
    if (!selectedControllers.includes(channel)) {
      setSelectedControllers([...selectedControllers, channel]);
    } else {
      setSelectedControllers(selectedControllers.filter((c) => c !== channel));
    }
  };

  const submit = async () => {
    setError(null);
    setControllers(selectedControllers);
    navigate({ pathname: STORAGE.zfcp.root });
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    const toActivate = controllers.filter(
      (c) => !c.active && selectedControllers.includes(c.channel),
    );

    if (!isEmpty(toActivate) || selectedControllers !== config.controllers) return submit();

    setError(_("Select the controllers to activate"));
  };

  const deactivatedControllers = controllers.filter((c) => !c.active);

  return (
    <>
      <LUNScanInfo />
      <Text>{_("Select the zFCP controllers to activate:")}</Text>
      <Form onSubmit={onSubmit}>
        {error && <Alert variant="warning" isInline title={error} />}
        {deactivatedControllers.map((controller, index) => {
          const channel = controller.channel;

          return (
            <FormGroup key={index}>
              <Checkbox
                id={`controller-${channel}`}
                label={<Text textStyle="fontSizeLg">{channel}</Text>}
                description={<ControllerOptionLabel controller={controller} />}
                isChecked={selectedControllers.includes(channel)}
                onChange={() => toggleController(channel)}
              />
            </FormGroup>
          );
        })}
        <ActionGroup>
          <Button type="submit">{_("Accept")}</Button>
          <Page.Back>{_("Cancel")}</Page.Back>
        </ActionGroup>
      </Form>
    </>
  );
};

/**
 * Content switcher for the zFCP controllers page.
 */
const ZFCPControllersContent = (): React.ReactNode => {
  const controllers = useControllers();
  const deactivatedControllers = controllers.filter((c) => !c.active);

  if (isEmpty(deactivatedControllers)) {
    return <NoControllersAvailable />;
  }

  return <ZFCPControllersForm />;
};

/**
 * Top-level page component for configuring the activation of zFCP controllers.
 */
export default function ZFCPControllersPage(): React.ReactNode {
  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: _("zFCP"), path: STORAGE.zfcp.root },
        { label: _("Activate controllers") },
      ]}
    >
      <Page.Content>
        <ZFCPControllersContent />
      </Page.Content>
    </Page>
  );
}
