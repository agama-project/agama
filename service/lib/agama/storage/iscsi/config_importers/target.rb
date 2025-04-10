# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/json_importer"
require "agama/storage/iscsi/configs/target"

module Agama
  module Storage
    module ISCSI
      module ConfigImporters
        # Class for generating an iSCSI target object from a JSON.
        class Target < JSONImporter
          # @return [Configs::Target]
          def target
            Configs::Target.new
          end

          # @see Agama::JSONImporter#imports
          def imports
            {
              address:            json[:address],
              port:               json[:port],
              name:               json[:name],
              interface:          json[:interface],
              startup:            json[:startup],
              username:           json.dig(:authByTarget, :username),
              password:           json.dig(:authByTarget, :password),
              initiator_username: json.dig(:authByInitiator, :username),
              initiator_password: json.dig(:authByInitiator, :password)
            }
          end
        end
      end
    end
  end
end
