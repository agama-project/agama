# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

Yast.import "IscsiClientLib"

module Agama
  module Storage
    module ISCSI
      # Class representing an open-iscsi initiator
      #
      # This class is a wrapper for YaST code dealing with the iSCSI initiator. Note that the YaST
      # code uses a singleton module, so different instances of this class always represent the very
      # same iSCSI initiator configured by YaST.
      class Initiator
        # Initiator name
        #
        # @return [String]
        def name
          Yast::IscsiClientLib.initiatorname
        end

        # Sets the inititator name
        #
        # @param value [String]
        def name=(value)
          return if Yast::IscsiClientLib.initiatorname == value

          Yast::IscsiClientLib.writeInitiatorName(value)
        end

        # Configured iSCSI offload card
        #
        # @return [String]
        def offload_card
          Yast::IscsiClientLib.GetOffloadCard()
        end

        # Sets the iSCSI offload card
        #
        # @param value [String]
        def offload_card=(value)
          Yast::IscsiClientLib.SetOffloadCard(value)
        end

        # Whether the initiator name was set via iBFT
        #
        # @return [Boolean]
        def ibft_name?
          !Yast::IscsiClientLib.getiBFT.fetch("iSCSI_INITIATOR_NAME", "").empty?
        end
      end
    end
  end
end
