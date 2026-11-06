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

require "y2storage/autoinst_profile/skip_list_value"

module Y2Storage
  module AutoinstProfile
    # AutoYaST device skip rule
    #
    # @example Using a rule
    #   Disk = Struct.new(:size_k)
    #   disk = Disk.new(8192)
    #   rule = Proposal::SkipRule.new(:size_k, :less_than, 16384)
    #   rule.matches?(disk) #=> true
    #
    # @example Creating a rule from an AutoYaST profile hash
    #   hash = { "skip_key" => "size_k", "skip_if_less_than" => 16384,
    #     "skip_value" => 1024 }
    #   Proposal::SkipRule.from_profile_hash(hash)
    #
    class SkipRule
      include Yast::Logger

      class NotValidSkipRule < StandardError; end

      # @return [String] Name of the attribute to check when applying the rule
      attr_reader :key
      # @return [Symbol] Comparison (:less_than, :more_than and :equal_to)
      attr_reader :predicate
      # @return [String] Reference value
      attr_reader :raw_reference

      # It runs 0
      PREDICATES = {
        less_than: [Integer].freeze,
        more_than: [Integer].freeze,
        equal_to:  [Integer, Symbol, String].freeze
      }.freeze

      class << self
        # Creates a rule from an AutoYaST profile rule definition
        #
        # Let's consider the following AutoYaST rule:
        #
        #   <listentry>
        #     <skip_key>size_k</skip_key>
        #     <skip_value>1048576</skip_value> <!-- translated as string -->
        #     <skip_if_less_than config:type="boolean">true</skip_if_less_than>
        #   </listentry>
        #
        # @example Building a rule from a hash
        #   hash # => { "skip_key" => "size_k", "skip_value" => "1048756",
        #     "skip_if_less_than" => true }
        #   rule = Proposal::SkipRule.new(hash)
        #   rule.predicate     #=> :less_than
        #   rule.raw_reference #=> "1048756"
        #   rule.key           #=> "size_k"
        def from_profile_rule(hash)
          predicate =
            if hash["skip_if_less_than"]
              :less_than
            elsif hash["skip_if_more_than"]
              :more_than
            else
              :equal_to
            end
          new(hash["skip_key"], predicate, hash["skip_value"])
        end
      end

      # Constructor
      #
      # @param key           [String] Name of the attribute to check when applying the rule
      # @param predicate     [Symbol,String] Comparison (:less_than, :more_than and :equal_to)
      # @param raw_reference [String] Reference value
      def initialize(key, predicate, raw_reference)
        @key = key
        @predicate = predicate
        @raw_reference = raw_reference
      end

      # Determines whether a disk matches the rule
      #
      # When the value coming from the disk is an array, it will match if any
      # of those values matches the reference.
      #
      # @param disk [Disk] Disk to match
      # @return [Boolean] true if the disk matches the rule
      def matches?(disk)
        return false unless valid?

        values_from_disk = Array(value(disk))
        values_from_disk.any? do |value|
          return false unless valid_class?(value)

          send("match_#{predicate}", value, cast_reference(raw_reference, value.class))
        end
      end

      # Determines whether the rule is valid
      #
      # A rule is valid when all elements (key, predicate and raw_reference)
      # are defined.
      #
      # @return [Boolean] true if the rule is valid
      def valid?
        key && predicate && raw_reference
      end

      # Returns the value to compare from the disk
      #
      # This method relies on SkipListValue which is able to gather
      # the required information from the disk.
      #
      # @see Proposal::SkipListValue
      def value(disk)
        SkipListValue.new(disk).public_send(key)
      rescue NoMethodError
        log.warn "Unknown skip list key: #{key}"
        false
      end

      # Rule definition in the AutoYaST profile format used by the AutoYaST
      # modules (nested arrays and hashes).
      #
      # Inverse of {.from_profile_rule}
      # @see SkipListSection#to_hashes
      #
      # @return [Hash]
      def to_profile_rule
        result = { "skip_key" => key, "skip_value" => raw_reference }
        case predicate
        when :less_than
          result["skip_if_less_than"] = true
        when :more_than
          result["skip_if_more_than"] = true
        end
        result
      end

      # Redefines #inspect method
      #
      # @return [String]
      def inspect
        "<SkipRule key='#{key}' predicate='#{predicate}' reference='#{raw_reference}'>"
      end

      private

      # Determines whether the predicate is applicable to the value
      #
      # @return [Boolean] true if it is applicable
      def valid_class?(value)
        PREDICATES[predicate].include?(value.class)
      end

      # Cast the reference value in order to do the comparison
      #
      # @param raw [String] Raw reference value (as it comes from the profile)
      # @return [String,Integer,Symbol] Converted reference value
      def cast_reference(raw, klass)
        if klass == Integer
          raw.to_i
        elsif klass == Symbol
          raw.to_sym
        else
          raw
        end
      end

      # less_than predicate
      #
      # @param value     [Integer] Value to compare
      # @param reference [Integer] Reference value
      # @return [Boolean] true if +value+ is less than +reference+.
      def match_less_than(value, reference)
        value < reference
      end

      # more_than predicate
      #
      # @param value     [Integer] Value to compare
      # @param reference [Integer] Reference value
      # @return [Boolean] true if +value+ is greater than +reference+.
      def match_more_than(value, reference)
        value > reference
      end

      # equal_to predicate
      #
      # @param value     [Integer] Value to compare
      # @param reference [Integer] Reference value
      # @return [Boolean] true if +value+ is equal to +reference+.
      def match_equal_to(value, reference)
        value == reference
      end
    end
  end
end
