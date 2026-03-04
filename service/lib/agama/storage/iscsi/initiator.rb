# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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

require "yast2/equatable"

module Agama
  module Storage
    module ISCSI
      # Class representing an open-iscsi initiator
      class Initiator
        include Yast2::Equatable

        # Initiator name
        #
        # @return [String]
        attr_accessor :name

        # Whether the initiator name was set via iBFT
        #
        # @return [Boolean]
        attr_accessor :ibft_name
        alias_method :ibft_name?, :ibft_name

        eql_attr :name, :ibft_name
      end
    end
  end
end
