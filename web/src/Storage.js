import { useState, useEffect } from 'react';
import { useInstallerClient } from './context/installer';

import TargetSelector from './TargetSelector';
import Proposal from './Proposal';

export default function Storage({ value, onChange = () => {} }) {
  const [proposal, setProposal] = useState([]);
  const [disks, setDisks] = useState(value);
  const client = useInstallerClient();

  const loadStorage = () => client.getStorage().then(setProposal);

  useEffect(() => {
    loadStorage();
    client.getDisks().then(setDisks);

    // TODO: abstract D-Bus details
    return client.onPropertyChanged((_path, iface, _signal, args) => {
      const [_, changes] = args;
      if (Object.keys(changes).includes("Disk")) {
        loadStorage();
      }
    });
  }, []);

  return (
    <div>
      <TargetSelector value={value || "Select target"} options={disks} onChange={onChange} />
      <Proposal data={proposal}/>
    </div>
  );
}
