import React from "react";
import {
  List,
  ListItem
} from "@patternfly/react-core";

const Proposal = ({ data = [] }) => {
  // FIXME: use better key for tr, mount can be empty
  const renderActions = () => {
    return data.map((p, i) => {
      return (
        <ListItem key={i}>{p.text}</ListItem>
      );
    });
  };

  if (data.length === 0) {
    return null;
  }

  return (
    <List>{renderActions()}</List>
  );
};

export default Proposal;
