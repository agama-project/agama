import React from "react";
import {
  TableComposable,
  Thead,
  Tr,
  Th,
  Tbody,
  Td
} from "@patternfly/react-table";

import filesize from "filesize";

const Proposal = ({ data = [] }) => {
  // FIXME: use better key for tr, mount can be empty
  const renderProposal = () => {
    return data.map(p => {
      return (
        <Tr key={p.mount}>
          <Td dataLabel="Mount Point">{p.mount}</Td>
          <Td dataLabel="Type">{p.type}</Td>
          <Td dataLabel="Device">{p.device}</Td>
          <Td dataLabel="Size">{filesize(p.size)}</Td>
        </Tr>
      );
    });
  };

  if (data.length === 0) {
    return null;
  }

  return (
    <TableComposable variant="compact">
      <Thead>
        <Tr>
          <Th>Mount point</Th>
          <Th>Type</Th>
          <Th>Device</Th>
          <Th>Size</Th>
        </Tr>
      </Thead>
      <Tbody>{renderProposal()}</Tbody>
    </TableComposable>
  );
};

export default Proposal;
