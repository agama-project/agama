import {
  Box,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td
} from '@chakra-ui/react';

import filesize from 'filesize';

const Proposal = ({data = []}) => {
  const renderProposal = () => {
    return data.map(p => {
      return (
        <Tr key={p.mount}>
          <Td>{p.mount}</Td>
          <Td>{p.type}</Td>
          <Td>{p.device}</Td>
          <Td isNumeric>{filesize(p.size)}</Td>
        </Tr>
      );
    })
  }

  if (data.length == 0) {
    return null;
  };

  return (
    <Table variant="simple" size="sm" minW="100%" colorScheme="blackAlpha">
      <Thead>
        <Tr>
          <Th>Mount point</Th>
          <Th>Type</Th>
          <Th>Device</Th>
          <Th isNumeric>Size</Th>
        </Tr>
      </Thead>
      <Tbody>
        { renderProposal() }
      </Tbody>
    </Table>
  );
}

export default Proposal;
