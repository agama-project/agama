import {
  Box,
  Heading,
  HStack,
  VStack,
  StackDivider,
  Icon,
  Text
} from '@chakra-ui/react';

export default function Category({ icon, title, children, ...rest }) {
  // FIXME: improve how icons are managed
  const Icon = icon;

  return (
    <Box p={5} shadow="sm" borderWidth="1px" minW="50%" {...rest}>
      <HStack spacing="1rem">
        <Icon size="48"/>
        <VStack width="100%" align="stretch" spacing="2" >
          <Heading fontSize="xl" mb={2}>{title}</Heading>
          { children }
        </VStack>
      </HStack>
    </Box>
  )
}
