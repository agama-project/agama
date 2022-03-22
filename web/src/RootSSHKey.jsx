import React, { useState } from "react";
import { FileUpload } from "@patternfly/react-core";

export default function RootSSHKey(props) {
  const [loading, setLoading] = useState(false);

  return (
    <FileUpload
      id="SSHKey"
      type="text"
      value={props.value}
      filenamePlaceholder="Drag and drop an SSH public key or upload one"
      onDataChange={value => {
        props.valueChanged(value);
      }}
      onTextChange={value => {
        props.valueChanged(value);
      }}
      onReadStarted={() => setLoading(true)}
      onReadFinished={() => setLoading(false)}
      onClearClick={props.valueChanged("")}
      isLoading={loading}
      browseButtonText="Upload"
    />
  );
}
