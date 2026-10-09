# Copyright (c) [2022] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "yast"

module Y2Storage
  # Mixin to ensure that security policies can be used
  #
  # The package yast2-security requires yast2-storage-ng as dependency, so yast2-storage-ng does not
  # require yast2-security at RPM level to avoid cyclic dependencies. Note that yast2-security is
  # always included in the installation image, but it could be missing at building time.
  # Missing yast2-security in a running system should not be relevant because the policies are
  # only checked during the installation.
  module WithSecurityPolicies
    include Yast::Logger

    # Runs a block ensuring that security policies are correctly loaded
    def with_security_policies
      require "y2security/security_policies"
      yield
    rescue LoadError
      log.warn("Security policies cannot be loaded. Make sure yast2-security is installed.")
      nil
    end
  end
end
