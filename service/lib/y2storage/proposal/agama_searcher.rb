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

require "agama/issue"

module Y2Storage
  module Proposal
    class AgamaSearcher
      include Yast::Logger
      include Yast::I18n

      # Constructor
      #
      def initialize
        textdomain "agama"
      end

      # The last two arguments get modified
      def search(devicegraph, settings, issues_list)
        settings.original_graph = devicegraph

        sids = []
        settings.drives.each do |drive|
          drive.search_device(devicegraph, sids)

          found = drive.found_device
          if found.nil?
            # TODO: If IfNotFound is 'skip' => 
            #   invalidate somehow the device definition (registering issue?)
            #
            # Let's assume IfNotFound is 'error'
            issues_list << issue_missing_drive(drive)
            return false
          end

          sids << found.sid
          next unless drive.partitions?

          drive.partitions.each do |part|
            part.search_device(devicegraph, found.sid, sids)
            part_sid = part.found_device&.sid
            sids << part_sid if part_sid
          end
        end

        true
      end

      private

      def issue_missing_drive(drive)
        Agama::Issue.new(
          _("No device found for a given drive"),
          source:   Agama::Issue::Source::CONFIG,
          severity: Agama::Issue::Severity::ERROR
        )
      end
    end
  end
end
