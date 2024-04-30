# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

module Agama
  module Storage
    # Class for configuring the boot settings of the Agama storage proposal.
    class BootSettings
      # Whether to configure partitions for booting.
      #
      # @return [Boolean]
      attr_accessor :configure
      alias_method :configure?, :configure

      # Device to use for booting.
      #
      # @return [String, nil]
      attr_accessor :device

      def initialize
        @configure = true
      end
    end
  end
end
