# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "agama/storage/config_conversions/from_json_conversions/search_conditions"
require "agama/storage/configs/search_conditions"
require "y2storage"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

module Agama
  module RSpec
    # RSpec extension to build search conditions in the matcher tests.
    module SearchMatcherHelpers
      # Converter able to build any condition, no matter the device it belongs to.
      #
      # The matchers are also tested with conditions that they must reject (e.g., a partitions
      # condition given to the volume group matcher). Such conditions cannot be built with the
      # converter of the corresponding device, since it only accepts the conditions allowed by the
      # JSON schema for that device.
      class AnyConditionConverter <
          Agama::Storage::ConfigConversions::FromJSONConversions::SearchConditions::Base
        include Agama::Storage::ConfigConversions::FromJSONConversions::SearchConditions::WithName
        include Agama::Storage::ConfigConversions::FromJSONConversions::SearchConditions::WithSize
        include Agama::Storage::ConfigConversions::FromJSONConversions::SearchConditions::WithDriver
        include Agama::Storage::ConfigConversions::FromJSONConversions::SearchConditions::
          WithTransport
        include Agama::Storage::ConfigConversions::FromJSONConversions::SearchConditions::
          WithPartitionNumber
        include Agama::Storage::ConfigConversions::FromJSONConversions::SearchConditions::
          WithPartitionId
        include Agama::Storage::ConfigConversions::FromJSONConversions::SearchConditions::
          WithFilesystem
        include Agama::Storage::ConfigConversions::FromJSONConversions::SearchConditions::
          WithPartitions
      end

      # Condition config from its JSON representation.
      #
      # @param json [Hash] Condition according to the JSON schema (e.g., { name: "/dev/vda" }).
      # @return [Agama::Storage::Configs::SearchConditions::*]
      def condition(json)
        AnyConditionConverter.new.convert(json)
      end

      # Size condition config.
      #
      # Directly built (instead of using its JSON representation) in order to check values and
      # operators that cannot be expressed with JSON.
      #
      # @param operator [Symbol]
      # @param value [Y2Storage::DiskSize, nil]
      #
      # @return [Agama::Storage::Configs::SearchConditions::Size]
      def size_condition(operator, value)
        Agama::Storage::Configs::SearchConditions::Size.new.tap do |config|
          config.operator = operator
          config.value = value
        end
      end
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * device: device to match.
#   * other_device: another device of the same type.
shared_examples "a matcher supporting the name condition" do
  describe "with a name condition" do
    it "matches if the device has the given name" do
      expect(subject.match?(condition(name: device.name), device)).to eq(true)
    end

    it "does not match if the device has another name" do
      expect(subject.match?(condition(name: other_device.name), device)).to eq(false)
    end

    it "matches if the condition has no name" do
      node = Agama::Storage::Configs::SearchConditions::Name.new(nil)
      expect(subject.match?(node, device)).to eq(true)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * device: device to match.
shared_examples "a matcher supporting the size condition" do
  describe "with a size condition" do
    it "matches if the size of the device is equal to the given value" do
      expect(subject.match?(size_condition(:equal, device.size), device)).to eq(true)
    end

    it "does not match if the size of the device is not equal to the given value" do
      node = size_condition(:equal, device.size + 1.KiB)
      expect(subject.match?(node, device)).to eq(false)
    end

    it "matches if the size of the device is greater than the given value" do
      node = size_condition(:greater, device.size - 1.KiB)
      expect(subject.match?(node, device)).to eq(true)
    end

    it "does not match if the size of the device is not greater than the given value" do
      expect(subject.match?(size_condition(:greater, device.size), device)).to eq(false)
    end

    it "matches if the size of the device is less than the given value" do
      node = size_condition(:less, device.size + 1.KiB)
      expect(subject.match?(node, device)).to eq(true)
    end

    it "does not match if the size of the device is not less than the given value" do
      expect(subject.match?(size_condition(:less, device.size), device)).to eq(false)
    end

    it "does not match if the operator is unknown" do
      expect(subject.match?(size_condition(:whatever, device.size), device)).to eq(false)
    end

    it "matches if the condition has no value" do
      expect(subject.match?(size_condition(:equal, nil), device)).to eq(true)
    end

    it "matches a condition given as JSON" do
      expect(subject.match?(condition(size: { greater: "1 KiB" }), device)).to eq(true)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * device: device to match.
#   * other_device: another device of the same type.
shared_examples "a matcher supporting operators" do
  describe "with an operator condition" do
    it "matches if there is no condition" do
      expect(subject.match?(nil, device)).to eq(true)
    end

    it "matches an 'and' condition if all the nested conditions match" do
      json = { and: [{ name: device.name }, { size: { greater: "1 KiB" } }] }
      expect(subject.match?(condition(json), device)).to eq(true)
    end

    it "does not match an 'and' condition if any nested condition does not match" do
      json = { and: [{ name: device.name }, { name: other_device.name }] }
      expect(subject.match?(condition(json), device)).to eq(false)
    end

    it "matches an 'or' condition if any nested condition matches" do
      json = { or: [{ name: other_device.name }, { name: device.name }] }
      expect(subject.match?(condition(json), device)).to eq(true)
    end

    it "does not match an 'or' condition if no nested condition matches" do
      json = { or: [{ name: other_device.name }, { size: { less: "1 KiB" } }] }
      expect(subject.match?(condition(json), device)).to eq(false)
    end

    it "matches a 'not' condition if the nested condition does not match" do
      expect(subject.match?(condition(not: { name: other_device.name }), device)).to eq(true)
    end

    it "does not match a 'not' condition if the nested condition matches" do
      expect(subject.match?(condition(not: { name: device.name }), device)).to eq(false)
    end

    it "matches nested operators" do
      json = {
        and: [
          { not: { name: other_device.name } },
          { or: [{ name: other_device.name }, { name: device.name }] }
        ]
      }
      expect(subject.match?(condition(json), device)).to eq(true)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * formatted_device: device with a filesystem of type #filesystem_type.
#   * unformatted_device: device without filesystem.
#   * filesystem_type: type of the filesystem of #formatted_device (e.g., "ext4").
#   * other_filesystem_type: any other filesystem type.
shared_examples "a matcher supporting the filesystem condition" do
  describe "with a filesystem condition" do
    let(:filesystem_label) { formatted_device.filesystem.label }

    it "matches a formatted device if the presence is 'any'" do
      expect(subject.match?(condition(filesystem: "any"), formatted_device)).to eq(true)
    end

    it "does not match an unformatted device if the presence is 'any'" do
      expect(subject.match?(condition(filesystem: "any"), unformatted_device)).to eq(false)
    end

    it "matches an unformatted device if the presence is 'none'" do
      expect(subject.match?(condition(filesystem: "none"), unformatted_device)).to eq(true)
    end

    it "does not match a formatted device if the presence is 'none'" do
      expect(subject.match?(condition(filesystem: "none"), formatted_device)).to eq(false)
    end

    it "matches if the device has a filesystem with the given type" do
      json = { filesystem: { type: filesystem_type } }
      expect(subject.match?(condition(json), formatted_device)).to eq(true)
    end

    it "does not match if the device has a filesystem with another type" do
      json = { filesystem: { type: other_filesystem_type } }
      expect(subject.match?(condition(json), formatted_device)).to eq(false)
    end

    it "does not match an unformatted device if a type is given" do
      json = { filesystem: { type: filesystem_type } }
      expect(subject.match?(condition(json), unformatted_device)).to eq(false)
    end

    it "matches if the device has a filesystem with the given label" do
      json = { filesystem: { label: filesystem_label } }
      expect(subject.match?(condition(json), formatted_device)).to eq(true)
    end

    it "does not match if the device has a filesystem with another label" do
      json = { filesystem: { label: "another_label" } }
      expect(subject.match?(condition(json), formatted_device)).to eq(false)
    end

    it "does not match an unformatted device if a label is given" do
      json = { filesystem: { label: "any_label" } }
      expect(subject.match?(condition(json), unformatted_device)).to eq(false)
    end

    it "matches nested filesystem conditions" do
      json = { filesystem: { and: [{ type: filesystem_type }, { label: filesystem_label }] } }
      expect(subject.match?(condition(json), formatted_device)).to eq(true)
    end

    it "matches a formatted device if the nested condition does not match a 'not' condition" do
      json = { filesystem: { not: { type: other_filesystem_type } } }
      expect(subject.match?(condition(json), formatted_device)).to eq(true)
    end

    it "does not match an unformatted device if a nested condition is given" do
      json = { filesystem: { not: { type: other_filesystem_type } } }
      expect(subject.match?(condition(json), unformatted_device)).to eq(false)
    end

    it "matches any device if the condition has neither presence nor nested condition" do
      node = Agama::Storage::Configs::SearchConditions::Filesystem.new
      expect(subject.match?(node, formatted_device)).to eq(true)
      expect(subject.match?(node, unformatted_device)).to eq(true)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * partitioned_device: device with two or more partitions.
#   * unpartitioned_device: device without partitions.
#   * partition_number: number of one of the partitions of #partitioned_device.
#   * missing_partition_number: number of no partition of #partitioned_device.
shared_examples "a matcher supporting the partitions condition" do
  describe "with a partitions condition" do
    it "matches a partitioned device if the presence is 'any'" do
      expect(subject.match?(condition(partitions: "any"), partitioned_device)).to eq(true)
    end

    it "does not match an unpartitioned device if the presence is 'any'" do
      expect(subject.match?(condition(partitions: "any"), unpartitioned_device)).to eq(false)
    end

    it "matches an unpartitioned device if the presence is 'none'" do
      expect(subject.match?(condition(partitions: "none"), unpartitioned_device)).to eq(true)
    end

    it "does not match a partitioned device if the presence is 'none'" do
      expect(subject.match?(condition(partitions: "none"), partitioned_device)).to eq(false)
    end

    it "matches an 'any' quantifier if a partition matches the condition" do
      json = { partitions: { any: { number: partition_number } } }
      expect(subject.match?(condition(json), partitioned_device)).to eq(true)
    end

    it "does not match an 'any' quantifier if no partition matches the condition" do
      json = { partitions: { any: { number: missing_partition_number } } }
      expect(subject.match?(condition(json), partitioned_device)).to eq(false)
    end

    it "matches a 'none' quantifier if no partition matches the condition" do
      json = { partitions: { none: { number: missing_partition_number } } }
      expect(subject.match?(condition(json), partitioned_device)).to eq(true)
    end

    it "does not match a 'none' quantifier if a partition matches the condition" do
      json = { partitions: { none: { number: partition_number } } }
      expect(subject.match?(condition(json), partitioned_device)).to eq(false)
    end

    it "matches an 'all' quantifier if all the partitions match the condition" do
      json = { partitions: { all: { size: { greater: "0 KiB" } } } }
      expect(subject.match?(condition(json), partitioned_device)).to eq(true)
    end

    it "does not match an 'all' quantifier if any partition does not match the condition" do
      json = { partitions: { all: { number: partition_number } } }
      expect(subject.match?(condition(json), partitioned_device)).to eq(false)
    end

    it "does not match an 'all' quantifier if the device has no partitions" do
      json = { partitions: { all: { size: { greater: "0 KiB" } } } }
      expect(subject.match?(condition(json), unpartitioned_device)).to eq(false)
    end

    it "matches a 'count' quantifier if the number of partitions is within the bounds" do
      expect(subject.match?(condition(partitions: { count: { min: 2 } }), partitioned_device))
        .to eq(true)
      expect(subject.match?(condition(partitions: { count: { max: 0 } }), unpartitioned_device))
        .to eq(true)
    end

    it "does not match a 'count' quantifier if the number of partitions exceeds the bounds" do
      expect(subject.match?(condition(partitions: { count: { max: 1 } }), partitioned_device))
        .to eq(false)
      expect(subject.match?(condition(partitions: { count: { min: 1 } }), unpartitioned_device))
        .to eq(false)
    end

    it "matches a 'count' quantifier counting only the partitions matching its condition" do
      json = {
        partitions: { count: { condition: { number: partition_number }, min: 1, max: 1 } }
      }
      expect(subject.match?(condition(json), partitioned_device)).to eq(true)
    end

    it "does not match a 'count' quantifier if no partition matches its condition" do
      json = {
        partitions: { count: { condition: { number: missing_partition_number }, min: 1 } }
      }
      expect(subject.match?(condition(json), partitioned_device)).to eq(false)
    end

    it "matches quantifiers without a nested condition" do
      any = Agama::Storage::Configs::SearchConditions::PartitionsAny.new
      none = Agama::Storage::Configs::SearchConditions::PartitionsNone.new
      all = Agama::Storage::Configs::SearchConditions::PartitionsAll.new

      expect(subject.match?(partitions_condition(any), partitioned_device)).to eq(true)
      expect(subject.match?(partitions_condition(any), unpartitioned_device)).to eq(false)
      expect(subject.match?(partitions_condition(none), unpartitioned_device)).to eq(true)
      expect(subject.match?(partitions_condition(none), partitioned_device)).to eq(false)
      expect(subject.match?(partitions_condition(all), partitioned_device)).to eq(true)
      expect(subject.match?(partitions_condition(all), unpartitioned_device)).to eq(false)
    end

    it "matches any device if the condition has neither presence nor quantifier" do
      node = Agama::Storage::Configs::SearchConditions::Partitions.new
      expect(subject.match?(node, partitioned_device)).to eq(true)
      expect(subject.match?(node, unpartitioned_device)).to eq(true)
    end

    def partitions_condition(quantifier)
      Agama::Storage::Configs::SearchConditions::Partitions.new(condition: quantifier)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * device: device to match.
shared_examples "a matcher rejecting the filesystem condition" do
  describe "with a filesystem condition" do
    it "does not match, no matter the value of the condition" do
      expect(subject.match?(condition(filesystem: "any"), device)).to eq(false)
      expect(subject.match?(condition(filesystem: "none"), device)).to eq(false)
      expect(subject.match?(condition(filesystem: { type: "ext4" }), device)).to eq(false)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * device: device to match.
shared_examples "a matcher rejecting the partitions condition" do
  describe "with a partitions condition" do
    it "does not match, no matter the value of the condition" do
      expect(subject.match?(condition(partitions: "any"), device)).to eq(false)
      expect(subject.match?(condition(partitions: "none"), device)).to eq(false)
      expect(subject.match?(condition(partitions: { count: { min: 1 } }), device)).to eq(false)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * device: device to match.
shared_examples "a matcher rejecting the partition number condition" do
  describe "with a partition number condition" do
    it "does not match" do
      expect(subject.match?(condition(number: 1), device)).to eq(false)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * device: device to match.
shared_examples "a matcher rejecting the partition id condition" do
  describe "with a partition id condition" do
    it "does not match" do
      expect(subject.match?(condition(id: "linux"), device)).to eq(false)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * device: device to match.
shared_examples "a matcher rejecting the driver condition" do
  describe "with a driver condition" do
    it "does not match" do
      expect(subject.match?(condition(driver: "ahci"), device)).to eq(false)
    end
  end
end

# Expects the following definitions:
#
#   * subject: matcher to test.
#   * device: device to match.
shared_examples "a matcher rejecting the transport condition" do
  describe "with a transport condition" do
    it "does not match" do
      expect(subject.match?(condition(transport: "usb"), device)).to eq(false)
    end
  end
end
