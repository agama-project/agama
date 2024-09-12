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

import React, { useId } from "react";
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
import { To, useNavigate } from "react-router-dom";
import { isEmpty, isObject } from "~/utils";

/**
 * Props accepted by Page.Section
 */
type SectionProps = {
  /** The section title */
  title?: string;
  /** The value used for accessible label */
  "aria-label"?: string;
  /** Part of the header that complements the title as a representation of the
   * section state. E.g. "Encryption enabled", where "Encryption" is the title
   * and "enabled" the value */
  value?: React.ReactNode;
  /** Elements to be rendered in the section footer */
  actions?: React.ReactNode;
  /** As sort as possible yet as much as needed text for describing what the section is about, if needed */
  description?: string;
  /** The heading level used for the section title */
  headerLevel?: TitleProps["headingLevel"];
  /** Props to influence PF/Card component wrapping the section */
  pfCardProps?: CardProps;
  /** Props to influence PF/CardHeader component wrapping the section title */
  pfCardHeaderProps?: CardHeaderProps;
  /** Props to influence PF/CardBody component wrapping the section content */
  pfCardBodyProps?: CardBodyProps;
};

type ActionProps = {
  /** Path to navigate to */
  navigateTo?: To;
} & ButtonProps;

type SubmitActionProps = {
  /** The id of a <form> the submit button is associated with */
  form: string;
} & ButtonProps;

const defaultCardProps: CardProps = {
  isRounded: true,
  isCompact: true,
  isFullHeight: true,
  component: "section",
};

const STICK_TO_TOP = Object.freeze({ default: "top" });
const STICK_TO_BOTTOM = Object.freeze({ default: "bottom" });

// TODO: check if it should have the banner role
const Header = ({ hasGutter = true, children, ...props }) => {
  return (
    <PageSection variant="light" component="div" stickyOnBreakpoint={STICK_TO_TOP} {...props}>
      <Stack hasGutter={hasGutter}>{children}</Stack>
    </PageSection>
  );
};

/**
 * Creates a page region on top of PF/Card component
 *
 * @example <caption>Simple usage</caption>
 *   <Page.Section>
 *     <EncryptionSummmary
 *   </Page.Section>
 *
 * @example <caption>Complex usage</caption>
 *   <Page.Section
 *     title="Encryption"
 *     value={isEnabled ? "Enabled" : "Disabled"}
 *     description="Whether device should be protected or not"
 *     pfCardBodyProps={{ isFilled: true }}
 *     actions={isEnabled ? <DisableAction /> : <EnableAction />}
 *   >
 *       <EncryptionSummary />
 *     )}
 *   </Page.Section>
 */
const Section = ({
  title,
  "aria-label": ariaLabel,
  value,
  description,
  actions,
  headerLevel: Title = "h3",
  pfCardProps,
  pfCardHeaderProps,
  pfCardBodyProps,
  children,
}: React.PropsWithChildren<SectionProps>) => {
  const titleId = useId();
  const hasTitle = !isEmpty(title);
  const hasValue = !isEmpty(value);
  const hasDescription = !isEmpty(description);
  const hasHeader = hasTitle || hasValue;
  const hasAriaLabel =
    !isEmpty(ariaLabel) || (isObject(pfCardProps) && "aria-label" in pfCardProps);
  const props = { ...defaultCardProps, "aria-label": ariaLabel };

  if (!hasTitle && !hasAriaLabel) {
    console.error("Page.Section must have either, a title or aria-label");
  }

  if (hasTitle && !hasAriaLabel) props["aria-labelledby"] = titleId;

  return (
    <Card {...props} {...pfCardProps}>
      {hasHeader && (
        <CardHeader {...pfCardHeaderProps}>
          <Flex direction="column" rowGap="rowGapXs" alignItems="alignItemsFlexStart">
            <Flex columnGap="columnGapSm" rowGap="rowGapXs" alignContent="alignContentFlexStart">
              {hasTitle && <Title id={titleId}>{title}</Title>}
              {hasValue && (
                <Flex.Item grow="grow" className={textStyles.fontSizeXl}>
                  {value}
                </Flex.Item>
              )}
            </Flex>
            {hasDescription && <div className={textStyles.color_200}>{description}</div>}
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
 * Wraps given children in an PF/PageGroup sticky at the bottom
 *
 * TODO: check if it contentinfo role really should have the banner role
 *
 * @see [PatternFly Page/PageGroup](https://www.patternfly.org/components/page#pagegroup)
 *
 * @example
 *   <Page.Actions>
 *     <Page.Action onCick={doSomething}>Let's go</Page.Action>
 *   </Page.Actions>
 *
 */
const Actions = ({ children }: React.PropsWithChildren) => {
  return (
    <PageGroup
      role="contentinfo"
      hasShadowTop
      stickyOnBreakpoint={STICK_TO_BOTTOM}
      className={flexStyles.flexGrow_0}
    >
      <PageSection variant="light" component="div">
        <Flex justifyContent="justifyContentFlexEnd">{children}</Flex>
      </PageSection>
    </PageGroup>
  );
};

/**
 * Handy component built on top of PF/Button for rendering a page action
 *
 * @see [PatternFly Button](https://www.patternfly.org/components/button).
 */
const Action = ({ navigateTo, children, ...props }: ActionProps) => {
  const navigate = useNavigate();

  const onClickFn = props.onClick;

  props.onClick = (e) => {
    if (typeof onClickFn === "function") onClickFn(e);
    if (navigateTo) navigate(navigateTo);
  };

  return (
    <Button size="lg" {...props}>
      {children}
    </Button>
  );
};

/**
 * Handy component for rendering a "Cancel" action
 *
 * NOTE: by default it navigates to the top path, which can be changed
 * `navigateTo` prop BUT not for navigating back into the history. Use Page.Back
 * for the latest, which behaves differently.
 */
const Cancel = ({ navigateTo = "..", children, ...props }: ActionProps) => {
  return (
    <Action variant="link" navigateTo={navigateTo} {...props}>
      {children || _("Cancel")}
    </Action>
  );
};

/**
 * Handy component for rendering a "Back" action
 *
 * NOTE: It does not behave like Page.Cancel, since
 *   * does not support changing the path to navigate to, and
 *   * always goes one path back in the history (-1)
 *
 * NOTE: Not using Page.Cancel for practical reasons about useNavigate
 * overloading, which kind of forces to write an ugly code for supporting both
 * types, "To" and "number", without a TypeScript complain. To know more, see
 * https://github.com/remix-run/react-router/issues/10505#issuecomment-2237126223
 */
const Back = ({ children, ...props }: Omit<ButtonProps, "onClick">) => {
  const navigate = useNavigate();

  return (
    <Button size="lg" variant="link" {...props} onClick={() => navigate(-1)}>
      {children || _("Back")}
    </Button>
  );
};

/**
 * Handy component to submit a form matching the id given in the `form` prop
 */
const Submit = ({ children, ...props }: SubmitActionProps) => {
  return (
    <Action type="submit" {...props}>
      {children || _("Accept")}
    </Action>
  );
};

/**
 * Wrapper for the section content built on top of PF/Page/PageSection
 *
 * @see [Patternfly Page/PageSection](https://www.patternfly.org/components/page#pagesection)
 */
const Content = ({ children, ...pageSectionProps }: React.PropsWithChildren<PageSectionProps>) => (
  <PageSection isFilled component="div" {...pageSectionProps}>
    {children}
  </PageSection>
);

/**
 * Component for structuing an Agama page, built on top of PF/Page/PageGroup.
 *
 * @see [Patternfly Page/PageGroup](https://www.patternfly.org/components/page#pagegroup)
 *
 * @example
 *   <Page>
 *     <Page.Header>
 *       <h2>{_("Software")}</h2>
 *     </Page.Header>
 *
 *     <Page.Content>
 *       <Stack hasGutter>
 *         <IssuesHint issues={issues} />
 *
 *         <Page.Section title="Selected patterns" >
 *           {patterns.length === 0 ? <NoPatterns /> : <SelectedPatterns patterns={patterns} />}
 *         </Page.Section>
 *
 *         <Page.Section aria-label="Used size">
 *           <UsedSize size={proposal.size} />
 *         </Page.Section>
 *       </Stack>
 *       <Page.Actions>
 *         <Page.Back />
 *       </Page.Actions>
 *     </Page.Content>
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
Page.Back = Back;
Page.Cancel = Cancel;
Page.Submit = Submit;
Page.Action = Action;
Page.Section = Section;

export default Page;
