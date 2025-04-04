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
require "agama/storage/iscsi/config"
require "agama/storage/iscsi/config_importers/target"

module Agama
  module Storage
    module ISCSI
      # Class for generating an iSCSI config object from a JSON.
      class ConfigImporter < JSONImporter
        # @return [Config]
        def target
          Config.new
        end

        # @see Agama::JSONImporter#imports
        def imports
          {
            initiator: json[:initiator],
            targets:   import_iscsi_targets
          }
        end

        def import_iscsi_targets
          targets_json = json[:targets]
          return unless targets_json

          targets_json.map { |t| ConfigImporters::Target.new(t).import }
        end
      end
    end
  end
end
