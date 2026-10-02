#
# Copyright (c) [2017] SUSE LLC
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

require "y2storage/autoinst_profile/skip_rule"

module Y2Storage
  module AutoinstProfile
    # Devices skip list in a <drive> section of an AutoYaST profile.
    #
    # This class determines when a device should be skipped based on a set of
    # predefined rules.
    #
    # Let's consider the following skip list in an AutoYaST profile:
    #
    #   <drive>
    #     <skip_list config:type="list">
    #       <listentry>
    #         <skip_key>driver</skip_key>
    #         <skip_value>usb-storage</skip_value>
    #       </listentry>
    #       <listentry>
    #         <skip_key>size_k</skip_key>
    #         <skip_value>1048576</skip_value>
    #         <skip_if_less_than config:type="boolean">true</skip_if_less_than>
    #       </listentry>
    #     </skip_list>
    #   </drive>
    #
    # More information can be found in the 'Partitioning' section of the AutoYaST documentation:
    # https://www.suse.com/documentation/sles-12/singlehtml/book_autoyast/book_autoyast.html#CreateProfile.Partitioning
    #
    # @example Building the list of rules from a hash
    #   list #=> [ {"skip_key" => "name", "skip_value" => "/dev/sda" }
    #   SkipList.from_profile(list)
    #
    class SkipListSection
      include Yast::Logger

      # @return [Array<SkipRule>] List of rules to apply
      attr_reader :rules
      #
      # @return [SectionWithAttributes] Parent section
      attr_reader :parent

      class << self
        # Creates a skip list from an AutoYaST profile
        #
        # @param profile_rules [Array<Hash>]           List of profile skip rules
        # @param parent        [#parent,#section_name] Parent section
        # @return [SkipList]
        def new_from_hashes(profile_rules, parent = nil)
          rules = profile_rules.map { |h| SkipRule.from_profile_rule(h) }
          new(rules, parent)
        end
      end

      # Constructor
      #
      # @param rules  [Array<SkipRule>]       List of rules to apply
      # @param parent [#parent,#section_name] parent section
      def initialize(rules, parent = nil)
        @rules = rules
        @parent = parent
      end

      # Determines whether a disk matches any of the rules on the list
      #
      # @return [Boolean] true only if it matches any rule
      def matches?(disk)
        valid, not_valid = rules.partition(&:valid?)
        log_not_valid_rules(not_valid) unless not_valid.empty?
        valid.any? { |r| r.matches?(disk) }
      end

      # Content of the section in the format used by the AutoYaST modules
      # (nested arrays and hashes).
      #
      # @return [Array<Hash>] each element represents an entry in the
      #   <skip_list> section
      def to_hashes
        rules.map(&:to_profile_rule)
      end

      # Return section name
      #
      # @return [String] "skip_list"
      def section_name
        "skip_list"
      end

      private

      # Log a list of rules as ignored
      #
      # @param not_valid_rules [Array<SkipRule>] List of ignored rules to log
      def log_not_valid_rules(not_valid_rules)
        ignored_descriptions = not_valid_rules.map(&:inspect).join(" ")
        log.error("Some skip rules were ignored: #{ignored_descriptions}")
      end
    end
  end
end
