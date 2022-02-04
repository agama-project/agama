import { useState, useEffect } from 'react';
import { useInstallerClient } from './context/installer';

import TargetSelector from './TargetSelector';
import Proposal from './Proposal';

export default function Storage() {
  const client = useInstallerClient();
  const [targets, setTargets] = useState([]);
  const [proposal, setProposal] = useState([]);
  const [target, setTarget] = useState("");

  const onAccept = (selected) => {
    client.setOption("Disk", selected).then(() => setTarget(selected));
  };

  useEffect(async () => {
    const proposal = await client.getStorage();
    const disk = await client.getOption("Disk");
    const disks = await client.getDisks();
    setTarget(disk);
    setTargets(disks);
    setProposal(proposal)
  }, []);

  useEffect(() => {
    // TODO: abstract D-Bus details
    return client.onPropertyChanged((_path, _iface, _signal, args) => {
      const [_, changes] = args;
      if (Object.keys(changes).includes("Disk")) {
        client.getStorage().then(setProposal);
      }
    });
  }, []);

  return (
    <div>
      <TargetSelector
        target={target || "Select target"}
        targets={targets}
        onAccept={onAccept} />
      <Proposal data={proposal}/>
    </div>
  );
}
