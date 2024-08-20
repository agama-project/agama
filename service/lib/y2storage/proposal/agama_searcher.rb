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

require "agama/issue"

module Y2Storage
  module Proposal
    # Auxiliary class to handle the 'search' elements within a storage configuration
    class AgamaSearcher
      include Yast::Logger
      include Yast::I18n

      # Constructor
      def initialize
        textdomain "agama"
      end

      # Resolve all the 'search' elements within a given configuration
      #
      # The second argument (the storage configuration) gets modified in several ways:
      #
      #   - All its 'search' elements get resolved, associating devices from the devicegraph
      #     (first argument) if some is found.
      #   - Some device definitions can get removed if configured to be skipped in absence of a
      #     corresponding device
      #
      # The third argument (the list of issues) gets modified by adding any found problem.
      #
      # @param devicegraph [Devicegraph] used to find the corresponding devices that will get
      #   associated to each search element
      # @param settings [Agama::Storage::Config] storage configuration containing device definitions
      #   like drives, volume groups, etc.
      # @param issues_list [Array<Agama::Issue>]
      def search(devicegraph, settings, issues_list)
        @sids = []
        settings.drives.each do |drive|
          drive.search_device(devicegraph, @sids)
          process_element(drive, settings.drives, issues_list)

          next unless drive.found_device && drive.partitions?

          drive.partitions.each do |part|
            next unless part.search

            part.search_device(drive.found_device, @sids)
            process_element(part, drive.partitions, issues_list)
          end
        end
      end

    private

      # @see #search
      def process_element(element, collection, issues_list)
        found = element.found_device
        if found
          @sids << found.sid
        else
          issues_list << not_found_issue(element)
          collection.delete(element) if element.search.skip_device?
        end
      end

      # Issue generated if a corresponding device is not found for the given element
      #
      # @param element [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Partition]
      # @return [Agama::Issue]
      def not_found_issue(element)
        Agama::Issue.new(
          issue_message(element),
          source:   Agama::Issue::Source::CONFIG,
          severity: issue_severity(element.search)
        )
      end

      # @see #not_found_issue
      def issue_message(element)
        if element.is_a?(Agama::Storage::Configs::Drive)
          if element.search.skip_device?
            _("No device found for an optional drive")
          else
            _("No device found for a mandatory drive")
          end
        elsif element.search.skip_device?
          _("No device found for an optional partition")
        else
          _("No device found for a mandatory partition")
        end
      end

      # @see #not_found_issue
      def issue_severity(search)
        return Agama::Issue::Severity::WARN if search.skip_device?

        Agama::Issue::Severity::ERROR
      end
    end
  end
end
