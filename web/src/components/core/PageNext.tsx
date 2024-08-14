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

import React from "react";
import {
  Button,
  ButtonProps,
  Card,
  CardBody,
  CardBodyProps,
  CardFooter,
  CardHeader,
  CardHeaderProps,
  CardProps,
  PageGroup,
  PageGroupProps,
  PageSection,
  PageSectionProps,
  Split,
  Stack,
  TitleProps,
} from "@patternfly/react-core";
import { Flex } from "~/components/layout";
import { _ } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import flexStyles from "@patternfly/react-styles/css/utilities/Flex/flex";
import { useNavigate } from "react-router-dom";

type SectionProps = {
  title?: string;
  value?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  descriptionProps?: CardBodyProps;
  headerLevel?: TitleProps["headingLevel"];
  pfCardProps?: CardProps;
  pfCardHeaderProps?: CardHeaderProps;
  pfCardBodyProps?: CardBodyProps;
};

// FIXME: add a Page.Back for navigationg to -1 insetad of ".."?
type PageActionProps = { navigateTo?: string | number } & ButtonProps;
type PageSubmitActionProps = { form: string } & ButtonProps;

const defaultCardProps: CardProps = { isRounded: true, isCompact: true, isFullHeight: true };

const Header = ({ hasGutter = true, children, ...props }) => {
  return (
    <PageSection variant="light" stickyOnBreakpoint={{ default: "top" }} {...props}>
      <Stack hasGutter={hasGutter}>{children}</Stack>
    </PageSection>
  );
};

/**
 * Creates a page region on top of PF/Card component
 *
 * @example <caption>Simple usage</caption>
 *   <Page.Section>
 *     <UserSectionContent />
 *   </Page.Section>
 */
const Section = ({
  title,
  value,
  description,
  actions,
  headerLevel: Title = "h3",
  pfCardProps,
  pfCardHeaderProps,
  pfCardBodyProps,
  children,
}: React.PropsWithChildren<SectionProps>) => {
  const renderTitle = !!title && title.trim() !== "";
  const renderValue = React.isValidElement(value);
  const renderDescription = !!description && description.trim() !== "";
  const renderHeader = renderTitle || renderValue;

  return (
    <Card {...defaultCardProps} {...pfCardProps}>
      {renderHeader && (
        <CardHeader {...pfCardHeaderProps}>
          <Flex direction="column" rowGap="rowGapXs" alignItems="alignItemsFlexStart">
            <Flex columnGap="columnGapSm" rowGap="rowGapXs" alignContent="alignContentFlexStart">
              {renderTitle && <Title>{title}</Title>}
              {renderValue && (
                <Flex.Item grow="grow" className={textStyles.fontSizeXl}>
                  {value}
                </Flex.Item>
              )}
            </Flex>
            {renderDescription && <div className={textStyles.color_200}>{description}</div>}
          </Flex>
        </CardHeader>
      )}
      <CardBody {...pfCardBodyProps}>{children}</CardBody>
      {actions && (
        <CardFooter>
          <Split hasGutter>{actions}</Split>
        </CardFooter>
      )}
    </Card>
  );
};

/**
 * Wraps given children in an PageGroup sticky at the bottom
 *
 * @example <caption>Simple usage</caption>
 *   <Page>
 *     <UserSectionContent />
 *   </Page>
 */
const Actions = ({ children }: React.PropsWithChildren) => {
  return (
    <PageGroup
      hasShadowTop
      stickyOnBreakpoint={{ default: "bottom" }}
      className={flexStyles.flexGrow_0}
    >
      <PageSection variant="light">
        <Flex justifyContent="justifyContentFlexEnd">{children}</Flex>
      </PageSection>
    </PageGroup>
  );
};

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
    // FIXME: look for a better overloading alternative. See https://github.com/remix-run/react-router/issues/10505#issuecomment-2237126223
    // and https://www.typescriptlang.org/docs/handbook/2/functions.html#function-overloads
    if (navigateTo) typeof navigateTo === "number" ? navigate(navigateTo) : navigate(navigateTo);
  };

  const buttonProps = { size: "lg" as const, ...props };
  return <Button {...buttonProps}>{children}</Button>;
};

/**
 * Convenient component for a "Cancel" action
 */
const Cancel = ({ navigateTo = "..", children, ...props }: PageActionProps) => {
  return (
    <Action variant="link" navigateTo={navigateTo} {...props}>
      {children || _("Cancel")}
    </Action>
  );
};

/**
 * Convenient component for a "form submission" action
 */
const Submit = ({ children, ...props }: PageSubmitActionProps) => {
  return (
    <Action type="submit" {...props}>
      {children || _("Accept")}
    </Action>
  );
};

const Content = ({ children, ...pageSectionProps }: React.PropsWithChildren<PageSectionProps>) => (
  <PageSection isFilled {...pageSectionProps}>
    {children}
  </PageSection>
);

/**
 * Wraps in a PF/PageGroup the content given by a router Outlet
 *
 * @example <caption>Simple usage</caption>
 *   <Page>
 *     <UserSectionContent />
 *   </Page>
 */
const Page = ({
  children,
  ...pageGroupProps
}: React.PropsWithChildren<PageGroupProps>): React.ReactNode => {
  return <PageGroup {...pageGroupProps}>{children}</PageGroup>;
};

Page.displayName = "agama/core/Page";
Page.Header = Header;
Page.Content = Content;
Page.Actions = Actions;
Page.Cancel = Cancel;
Page.Submit = Submit;
Page.Action = Action;
Page.Section = Section;

export default Page;
