import React, { useState, useEffect } from "react";
import { FileUpload } from '@patternfly/react-core';

export default function RootSSHKey {
    const (value, setValue) = useState("");
    const (fileame, setFilename) = useState("");
    const (loading, setLoading) = useState(false);

    useEffect(async () => {
        const key = await client.users.RootSSHKey();
        setValue(key);
      }, []);

    return (
        <FileUpload
          id="simple-text-file"
          type="text"
          value={value}
          filename={filename}
          filenamePlaceholder="Drag and drop a file or upload one"
          onFileInputChange={(_event, file) => setFilename(file.name)}
          onDataChange={value => setValue(value )}
          onTextChange={value => setValue(value )}
          onReadStarted={() => setLoading(true)}
          onReadFinished={() => setLoading(false)}
          onClearClick={() => setFilename(""); setValue("")}
          isLoading={loading}
          browseButtonText="Upload"
        />
      );
}