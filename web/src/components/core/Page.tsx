/*
 * Copyright (c) [2023] SUSE LLC
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

import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Button,
  ButtonProps,
  Card,
  CardBody,
  CardHeader,
  Flex,
  PageGroup,
  PageSection,
  Stack,
} from "@patternfly/react-core";
import { _ } from "~/i18n";
import tabsStyles from "@patternfly/react-styles/css/components/Tabs/tabs";
import flexStyles from "@patternfly/react-styles/css/utilities/Flex/flex";

type PageActionProps = { navigateTo?: string } & ButtonProps;
type PageCancelActionProps = { text?: string } & PageActionProps;

/**
 * A convenient component for rendering a page action
 *
 * Built on top of {@link https://www.patternfly.org/components/button | PF/Button}
 */
const Action = ({ navigateTo, children, ...props }: PageActionProps) => {
  const navigate = useNavigate();

  const onClickFn = props.onClick;

  props.onClick = (e) => {
    if (typeof onClickFn === "function") onClickFn(e);
    if (navigateTo) navigate(navigateTo);
  };

  const buttonProps = { size: "lg" as const, ...props };
  return <Button {...buttonProps}>{children}</Button>;
};

/**
 * Convenient component for a Cancel / Back action
 */
const CancelAction = ({
  text = _("Cancel"),
  navigateTo = "..",
  ...props
}: PageCancelActionProps) => {
  return (
    <Action variant="link" navigateTo={navigateTo} {...props}>
      {text}
    </Action>
  );
};

/**
 * Wrapper component built on top of PF/PageSection for holding the Page actions
 *
 * Required for placing content to be used as Page actions, usually a
 * Page.Action or a  PF/Button
 */
const Actions = ({ children }: React.PropsWithChildren) => (
  <PageSection
    hasShadowTop
    className={flexStyles.flexGrow_0}
    stickyOnBreakpoint={{ default: "bottom" }}
    variant="light"
  >
    <Flex justifyContent={{ default: "justifyContentFlexEnd" }}>{children}</Flex>
  </PageSection>
);

const MainContent = ({ children, ...props }) => (
  <PageSection isFilled {...props}>
    {children}
  </PageSection>
);

const Navigation = ({ routes }) => {
  if (!Array.isArray(routes) || routes.length === 0) return;

  // FIXME: routes should have a "subnavigation" flag to decide if should be
  // rendered here. For example, Storage/iSCSI, Storage/DASD and so on might be
  // not part of this navigation but part of an expandable menu.
  //
  // FIXME: extract to a component since using PF/Tab is not possible to achieve
  // it because the tabs needs a content. As a reference, see https://github.com/patternfly/patternfly-org/blob/b2dbe716096e05cc68d3c85ada692e6140b4e992/packages/documentation-framework/templates/mdx.js#L304-L323
  return (
    <PageSection variant="light" type="tabs" stickyOnBreakpoint={{ default: "top" }}>
      <nav className={tabsStyles.tabs}>
        <ul className={tabsStyles.tabsList}>
          {routes
            .filter((r) => r.handle?.name)
            .map((r, i) => (
              <li className={tabsStyles.tabsItem} key={r.path || i}>
                <NavLink
                  end
                  to={r.path}
                  className={({ isActive }) =>
                    [tabsStyles.tabsLink, isActive ? "pf-m-current" : ""].join(" ")
                  }
                >
                  {r.handle?.name}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>
    </PageSection>
  );
};

const Header = ({ hasGutter = true, children, ...props }) => {
  return (
    <PageSection variant="light" stickyOnBreakpoint={{ default: "top" }} {...props}>
      <Stack hasGutter={hasGutter}>{children}</Stack>
    </PageSection>
  );
};

const CardSection = ({ title, children, ...props }) => {
  return (
    <Card isRounded isCompact {...props}>
      {title && <CardHeader> {title} </CardHeader>}
      {children && <CardBody>{children}</CardBody>}
    </Card>
  );
};

/**
 * Wraps children in a PF/PageGroup
 *
 * @example <caption>Simple usage</caption>
 *   <Page>
 *     <UserSectionContent />
 *   </Page>
 */
const Page = ({ children }) => {
  return <PageGroup>{children}</PageGroup>;
};

Page.CardSection = CardSection;
Page.NextActions = Actions;
Page.Action = Action;
Page.MainContent = MainContent;
Page.CancelAction = CancelAction;
Page.Header = Header;

export default Page;
