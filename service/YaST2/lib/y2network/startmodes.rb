# Vendored from yast2-network's network/src/lib/y2network/startmodes.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "y2network/startmodes/auto"
require "y2network/startmodes/hotplug"
require "y2network/startmodes/ifplugd"
require "y2network/startmodes/manual"
require "y2network/startmodes/nfsroot"
require "y2network/startmodes/off"
