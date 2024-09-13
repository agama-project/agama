/*
 * Copyright (c) [2024] SUSE LLC
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
import { Card, CardBody, Form, Grid, GridItem, Radio, Stack } from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { Page } from "~/components/core";
import { SpaceActionsTable } from "~/components/storage";
import { SPACE_POLICIES, SpacePolicy } from "~/components/storage/utils";
import { noop } from "~/utils";
import { _ } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { SpaceAction } from "~/types/storage";
import { useProposalMutation, useProposalResult } from "~/queries/storage";

/**
 * Widget to allow user picking desired policy to make space.
 * @component
 *
 * @param props
 * @param props.currentPolicy
 * @param [props.onChange]
 */
const SpacePolicyPicker = ({
  currentPolicy,
  onChange = noop,
}: {
  currentPolicy: SpacePolicy;
  onChange?: (policy: SpacePolicy) => void;
}) => {
  return (
    <Page.Section>
      <Stack hasGutter>
        {/* eslint-disable agama-i18n/string-literals */}
        {SPACE_POLICIES.map((policy) => {
          const isChecked = currentPolicy?.id === policy.id;
          let labelStyle = textStyles.fontSizeLg;
          if (isChecked) labelStyle += ` ${textStyles.fontWeightBold}`;

          return (
            <Radio
              name="policy"
              key={policy.id}
              id={policy.id}
              value={policy.id}
              label={<span className={labelStyle}>{_(policy.label)}</span>}
              body={<span className={textStyles.color_200}>{_(policy.description)}</span>}
              onChange={() => onChange(policy)}
              defaultChecked={isChecked}
            />
          );
        })}
        {/* eslint-enable agama-i18n/string-literals */}
      </Stack>
    </Page.Section>
  );
};

/**
 * Renders a page that allows the user to select the space policy and actions.
 */
export default function SpacePolicySelection() {
  const { settings } = useProposalResult();
  const { mutateAsync: updateProposal } = useProposalMutation();
  const [state, setState] = useState({ load: false });
  const [policy, setPolicy] = useState<SpacePolicy | undefined>();
  const [actions, setActions] = useState([]);
  const [expandedDevices, setExpandedDevices] = useState([]);
  const [customUsed, setCustomUsed] = useState(false);
  const [devices, setDevices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (state.load) return;

    // FIXME: move to a state/reducer
    const policy = SPACE_POLICIES.find((p) => p.id === settings.spacePolicy);
    setPolicy(policy);
    setActions(settings.spaceActions);
    setCustomUsed(policy.id === "custom");
    setDevices(settings.installationDevices);
    setState({ load: true });
  }, [state]);

  useEffect(() => {
    if (policy?.id === "custom") setExpandedDevices(devices);
  }, [devices, policy, setExpandedDevices]);

  // The selectors for the space action have to be initialized always to the same value
  // (e.g., "keep") when the custom policy is selected for first time. The following two useEffect
  // ensures that.

  // Stores whether the custom policy has been used.
  useEffect(() => {
    if (policy?.id === "custom" && !customUsed) setCustomUsed(true);
  }, [policy, customUsed, setCustomUsed]);

  // Resets actions (i.e., sets everything to "keep") if the custom policy has not been used yet.
  useEffect(() => {
    if (policy && policy.id !== "custom" && !customUsed) setActions([]);
  }, [policy, customUsed, setActions]);

  if (!state.load) return;

  // Generates the action value according to the policy.
  const deviceAction = (device) => {
    if (policy?.id === "custom") {
      return actions.find((a) => a.device === device.name)?.action || "keep";
    }

    const policyAction = { delete: "force_delete", resize: "resize", keep: "keep" };
    return policyAction[policy?.id];
  };

  const changeActions = (spaceAction: SpaceAction) => {
    const spaceActions = actions.filter((a) => a.device !== spaceAction.device);
    if (spaceAction.action !== "keep") spaceActions.push(spaceAction);

    setActions(spaceActions);
  };

  const onSubmit = (e) => {
    e.preventDefault();

    updateProposal({
      ...settings,
      spacePolicy: policy.id,
      spaceActions: actions,
    });
    navigate("..");
  };

  const xl2Columns = policy.id === "custom" ? 6 : 12;

  return (
    <Page>
      <Page.Header>
        <h2>{_("Space policy")}</h2>
      </Page.Header>

      <Page.Content>
        <Form id="space-policy-form" onSubmit={onSubmit}>
          <Grid hasGutter>
            <GridItem sm={12} xl2={xl2Columns}>
              <SpacePolicyPicker currentPolicy={policy} onChange={setPolicy} />
            </GridItem>
            {policy.id === "custom" && devices.length > 0 && (
              <GridItem sm={12} xl2={xl2Columns}>
                <Card isFullHeight isRounded>
                  <CardBody>
                    <SpaceActionsTable
                      devices={devices}
                      expandedDevices={expandedDevices}
                      deviceAction={deviceAction}
                      onActionChange={changeActions}
                    />
                  </CardBody>
                </Card>
              </GridItem>
            )}
          </Grid>
        </Form>
      </Page.Content>
      <Page.Actions>
        <Page.Cancel />
        <Page.Submit form="space-policy-form" type="submit" />
      </Page.Actions>
    </Page>
  );
}
