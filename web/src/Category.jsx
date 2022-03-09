import React from "react";
import {
  Card,
  CardBody,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Text,
  TextContent,
  TextVariants
} from "@patternfly/react-core";

export default function Category({ icon, title, children }) {
  // FIXME: improve how icons are managed
  const Icon = icon;

  return (
    <Split hasGutter>
      <SplitItem>
        <Icon size="32" />
      </SplitItem>
      <SplitItem isFilled>
        <Stack>
          <StackItem>
            <TextContent>
              <Text component={TextVariants.h2}>{title}</Text>
            </TextContent>
          </StackItem>
          <StackItem>
            {children}
          </StackItem>
        </Stack>
      </SplitItem>
    </Split>
  );
}
