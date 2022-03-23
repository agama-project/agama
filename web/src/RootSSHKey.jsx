import React, { useState } from "react";
import { FileUpload } from "@patternfly/react-core";

export default function RootSSHKey({ value, onValueChange }) {
  const [loading, setLoading] = useState(false);

  return (
    <FileUpload
      id="SSHKey"
      type="text"
      value={value}
      filenamePlaceholder="Drag and drop a SSH public key or upload one"
      onDataChange={onValueChange}
      onTextChange={onValueChange}
      onReadStarted={() => setLoading(true)}
      onReadFinished={() => setLoading(false)}
      onClearClick={() => onValueChange("")}
      isLoading={loading}
      browseButtonText="Upload"
    />
  );
}
