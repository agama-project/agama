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

module DInstaller
  module Storage
    module Iscsi
      # The Open-iscsi initiator
      class Initiator
        def name
          Yast::IscsiClientLib.initiatorname
        end

        def name=(new_name)
          return if Yast::IscsiClientLib.initiatorname == new_name

          Yast::IscsiClientLib.writeInitiatorName(new_name)
        end

        def offload_card
          Yast::IscsiClientLib.GetOffloadCard()
        end

        def offload_card=(card)
          Yast::IscsiClientLib.SetOffloadCard(card)
        end

        def ibft_name?
          !Yast::IscsiClientLib.getiBFT.fetch("iSCSI_INITIATOR_NAME", "").empty?
        end
      end
    end
  end
end
