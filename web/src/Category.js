import {
  Card,
  CardBody,
  Split,
  SplitItem,
  Text,
  TextContent,
  TextVariants
} from '@patternfly/react-core';

export default function Category({ icon, title, children, ...rest }) {
  // FIXME: improve how icons are managed
  const Icon = icon;

  return (
    <Card {...rest}>
      <CardBody>
        <Split>
          <SplitItem>
            <Icon size="48"/>
          </SplitItem>
          <SplitItem>
            <TextContent>
              <Text component={TextVariants.h2}>{title}</Text>
            </TextContent>
            { children }
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  )
}
