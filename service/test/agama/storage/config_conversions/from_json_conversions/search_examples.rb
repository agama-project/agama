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

require "agama/storage/config_conversions/from_json_conversions/search_errors"
require "agama/storage/configs/search"
require "agama/storage/configs/search_conditions"
require "agama/storage/configs/sort_criteria"
require "y2storage/data_transport"
require "y2storage/filesystems/type"
require "y2storage/partition_id"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

# All the search converters are expected to define the following:
#
#   * subject: converter to test, built from #config_json.
#   * config_json: JSON of the search, including #condition, #sort, #max and #if_not_found.
#   * condition: JSON of the condition, nil by default.
#   * sort: JSON of the sort criteria, nil by default.
#   * max: value of 'max', nil by default.
#   * if_not_found: value of 'ifNotFound', nil by default.
shared_examples "a search converter" do
  it "returns a search config" do
    expect(subject.convert).to be_a(Agama::Storage::Configs::Search)
  end

  context "with a device name" do
    let(:config_json) { "/dev/vda1" }

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Name)
      expect(config.condition.name).to eq("/dev/vda1")
    end

    it "sets #max to the expected value" do
      expect(subject.convert.max).to be_nil
    end

    it "sets #if_not_found to the expected value" do
      expect(subject.convert.if_not_found).to eq(:error)
    end
  end

  context "with an asterisk" do
    let(:config_json) { "*" }

    it "sets #condition to the expected value" do
      expect(subject.convert.condition).to be_nil
    end

    it "sets #max to the expected value" do
      expect(subject.convert.max).to be_nil
    end

    it "sets #if_not_found to the expected value" do
      expect(subject.convert.if_not_found).to eq(:skip)
    end
  end

  context "if 'condition' is not specified" do
    let(:condition) { nil }

    it "sets #condition to the expected value" do
      expect(subject.convert.condition).to be_nil
    end
  end

  context "if 'sort' is not specified" do
    let(:sort) { nil }

    it "sets #sort_criteria to the expected value" do
      expect(subject.convert.sort_criteria).to eq([])
    end
  end

  context "if 'max' is not specified" do
    let(:max) { nil }

    it "sets #max to the expected value" do
      expect(subject.convert.max).to be_nil
    end
  end

  context "if 'ifNotFound' is not specified" do
    let(:if_not_found) { nil }

    it "sets #if_not_found to the expected value" do
      expect(subject.convert.if_not_found).to eq(:error)
    end
  end

  context "if 'max' is specified" do
    let(:max) { 3 }

    it "sets #max to the expected value" do
      expect(subject.convert.max).to eq(3)
    end
  end

  context "if 'ifNotFound' is specified" do
    let(:if_not_found) { "skip" }

    it "sets #if_not_found to the expected value" do
      expect(subject.convert.if_not_found).to eq(:skip)
    end
  end
end

shared_examples "a search converter supporting the name condition" do
  context "if 'name' is specified" do
    let(:condition) { { name: "/dev/vda" } }

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Name)
      expect(config.condition.name).to eq("/dev/vda")
    end
  end
end

shared_examples "a search converter supporting the size condition" do
  context "if 'size' is specified" do
    let(:condition) { { size: size } }

    context "without operator" do
      let(:size) { "2 GiB" }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Size)
        expect(config.condition.value).to eq(2.GiB)
        expect(config.condition.operator).to eq(:equal)
      end
    end

    context "with 'equal' operator" do
      let(:size) { { equal: "2 GiB" } }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition.value).to eq(2.GiB)
        expect(config.condition.operator).to eq(:equal)
      end
    end

    context "with 'greater' operator" do
      let(:size) { { greater: "2 GiB" } }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition.value).to eq(2.GiB)
        expect(config.condition.operator).to eq(:greater)
      end
    end

    context "with 'less' operator" do
      let(:size) { { less: "2 GiB" } }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition.value).to eq(2.GiB)
        expect(config.condition.operator).to eq(:less)
      end
    end
  end
end

shared_examples "a search converter supporting the driver condition" do
  context "if 'driver' is specified" do
    let(:condition) { { driver: "ahci" } }

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Driver)
      expect(config.condition.driver).to eq("ahci")
    end
  end
end

shared_examples "a search converter supporting the transport condition" do
  context "if 'transport' is specified" do
    let(:condition) { { transport: "usb" } }

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Transport)
      expect(config.condition.transport).to eq(Y2Storage::DataTransport::USB)
    end
  end
end

shared_examples "a search converter supporting the partition number condition" do
  context "if 'number' is specified" do
    let(:condition) { { number: 2 } }

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::PartitionNumber)
      expect(config.condition.number).to eq(2)
    end
  end
end

shared_examples "a search converter supporting the partition id condition" do
  context "if 'id' is specified" do
    let(:condition) { { id: "esp" } }

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::PartitionId)
      expect(config.condition.id).to eq(Y2Storage::PartitionId::ESP)
    end
  end

  context "if 'id' is specified with a GPT-only value" do
    let(:condition) { { id: "linux_root_x86_64" } }

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::PartitionId)
      expect(config.condition.id).to eq(Y2Storage::PartitionId::LINUX_ROOT_X86_64)
    end
  end
end

shared_examples "a search converter supporting the filesystem condition" do
  context "if 'filesystem' is specified" do
    context "with the 'any' presence shortcut" do
      let(:condition) { { filesystem: "any" } }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Filesystem)
        expect(config.condition.presence).to eq(:any)
        expect(config.condition.condition).to be_nil
      end
    end

    context "with the 'none' presence shortcut" do
      let(:condition) { { filesystem: "none" } }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition.presence).to eq(:none)
        expect(config.condition.condition).to be_nil
      end
    end

    context "with a filesystem type condition" do
      let(:condition) { { filesystem: { type: "ext4" } } }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Filesystem)
        expect(config.condition.presence).to be_nil

        inner = config.condition.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::FilesystemType)
        expect(inner.fs_type).to eq(Y2Storage::Filesystems::Type::EXT4)
      end
    end

    context "with a filesystem label condition" do
      let(:condition) { { filesystem: { label: "data" } } }

      it "sets #condition to the expected value" do
        inner = subject.convert.condition.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::FilesystemLabel)
        expect(inner.label).to eq("data")
      end
    end

    context "with an 'and' operator over filesystem conditions" do
      let(:condition) do
        { filesystem: { and: [{ type: "btrfs" }, { label: "root" }] } }
      end

      it "sets #condition to the expected value" do
        inner = subject.convert.condition.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::And)

        conditions = inner.conditions
        expect(conditions.size).to eq(2)

        expect(conditions[0]).to be_a(Agama::Storage::Configs::SearchConditions::FilesystemType)
        expect(conditions[0].fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)

        expect(conditions[1]).to be_a(Agama::Storage::Configs::SearchConditions::FilesystemLabel)
        expect(conditions[1].label).to eq("root")
      end
    end

    context "with a 'not' operator over a filesystem condition" do
      let(:condition) { { filesystem: { not: { type: "swap" } } } }

      it "sets #condition to the expected value" do
        inner = subject.convert.condition.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::Not)

        type_condition = inner.condition
        expect(type_condition).to be_a(Agama::Storage::Configs::SearchConditions::FilesystemType)
        expect(type_condition.fs_type).to eq(Y2Storage::Filesystems::Type::SWAP)
      end
    end

    context "nested inside a device-level operator" do
      let(:condition) do
        { and: [{ name: "/dev/vda" }, { filesystem: "none" }] }
      end

      it "sets #condition to the expected value" do
        conditions = subject.convert.condition.conditions
        expect(conditions[1]).to be_a(Agama::Storage::Configs::SearchConditions::Filesystem)
        expect(conditions[1].presence).to eq(:none)
      end
    end

    context "with an unknown filesystem condition" do
      let(:condition) { { filesystem: { whatever: "value" } } }

      it "raises an error" do
        expect { subject.convert }.to raise_error(
          Agama::Storage::ConfigConversions::FromJSONConversions::UnsupportedSearchCondition
        )
      end
    end
  end
end

shared_examples "a search converter supporting the partitions condition" do
  context "if 'partitions' is specified" do
    context "with the 'any' presence shortcut" do
      let(:condition) { { partitions: "any" } }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Partitions)
        expect(config.condition.presence).to eq(:any)
        expect(config.condition.condition).to be_nil
      end
    end

    context "with the 'none' presence shortcut" do
      let(:condition) { { partitions: "none" } }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition.presence).to eq(:none)
        expect(config.condition.condition).to be_nil
      end
    end

    context "with an 'any' quantifier" do
      let(:condition) { { partitions: { any: { size: { greater: "10 GiB" } } } } }

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Partitions)
        expect(config.condition.presence).to be_nil

        cond = config.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsAny)
        expect(cond.condition).to be_a(Agama::Storage::Configs::SearchConditions::Size)
        expect(cond.condition.value).to eq(10.GiB)
        expect(cond.condition.operator).to eq(:greater)
      end
    end

    context "with a 'none' quantifier" do
      let(:condition) { { partitions: { none: { filesystem: "any" } } } }

      it "sets #condition to the expected value" do
        cond = subject.convert.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsNone)

        inner = cond.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::Filesystem)
        expect(inner.presence).to eq(:any)
      end
    end

    context "with an 'all' quantifier" do
      let(:condition) { { partitions: { all: { name: "/dev/vda1" } } } }

      it "sets #condition to the expected value" do
        cond = subject.convert.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsAll)

        inner = cond.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::Name)
        expect(inner.name).to eq("/dev/vda1")
      end
    end

    context "with a 'count' quantifier with only min" do
      let(:condition) { { partitions: { count: { min: 2 } } } }

      it "sets #condition to the expected value" do
        cond = subject.convert.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsCount)
        expect(cond.min).to eq(2)
        expect(cond.max).to be_nil
        expect(cond.condition).to be_nil
      end
    end

    context "with a 'count' quantifier with only max" do
      let(:condition) { { partitions: { count: { max: 3 } } } }

      it "sets #condition to the expected value" do
        cond = subject.convert.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsCount)
        expect(cond.max).to eq(3)
        expect(cond.min).to be_nil
        expect(cond.condition).to be_nil
      end
    end

    context "with a 'count' quantifier with condition, min and max" do
      let(:condition) do
        {
          partitions: {
            count: { condition: { size: { greater: "10 GiB" } }, min: 2, max: 5 }
          }
        }
      end

      it "sets #condition to the expected value" do
        cond = subject.convert.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsCount)

        expect(cond.condition).to be_a(Agama::Storage::Configs::SearchConditions::Size)
        expect(cond.condition.value).to eq(10.GiB)
        expect(cond.min).to eq(2)
        expect(cond.max).to eq(5)
      end
    end

    context "with a quantifier containing an 'id' condition" do
      let(:condition) { { partitions: { any: { id: "esp" } } } }

      it "sets #condition to the expected value" do
        cond = subject.convert.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsAny)

        inner = cond.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::PartitionId)
        expect(inner.id).to eq(Y2Storage::PartitionId::ESP)
      end
    end

    context "with a 'count' quantifier containing an 'id' condition" do
      let(:condition) do
        { partitions: { count: { condition: { id: "swap" }, min: 1 } } }
      end

      it "sets #condition to the expected value" do
        cond = subject.convert.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsCount)
        expect(cond.min).to eq(1)

        inner = cond.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::PartitionId)
        expect(inner.id).to eq(Y2Storage::PartitionId::SWAP)
      end
    end

    context "with a quantifier containing a 'number' condition" do
      let(:condition) { { partitions: { any: { number: 1 } } } }

      it "sets #condition to the expected value" do
        cond = subject.convert.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsAny)

        inner = cond.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::PartitionNumber)
        expect(inner.number).to eq(1)
      end
    end

    context "with a quantifier containing an operator" do
      let(:condition) do
        {
          partitions: {
            all: {
              and: [
                { id: "linux" },
                { not: { filesystem: "none" } }
              ]
            }
          }
        }
      end

      it "sets #condition to the expected value" do
        cond = subject.convert.condition.condition
        expect(cond).to be_a(Agama::Storage::Configs::SearchConditions::PartitionsAll)

        inner = cond.condition
        expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::And)

        conditions = inner.conditions
        expect(conditions.size).to eq(2)

        expect(conditions[0]).to be_a(Agama::Storage::Configs::SearchConditions::PartitionId)
        expect(conditions[0].id).to eq(Y2Storage::PartitionId::LINUX)

        expect(conditions[1]).to be_a(Agama::Storage::Configs::SearchConditions::Not)

        negated = conditions[1].condition
        expect(negated).to be_a(Agama::Storage::Configs::SearchConditions::Filesystem)
        expect(negated.presence).to eq(:none)
      end
    end

    context "with a quantifier containing a condition of another kind of device" do
      let(:condition) { { partitions: { any: { transport: "usb" } } } }

      it "raises an error" do
        expect { subject.convert }.to raise_error(
          Agama::Storage::ConfigConversions::FromJSONConversions::UnsupportedSearchCondition
        )
      end
    end

    context "with an unknown quantifier" do
      let(:condition) { { partitions: { whatever: { name: "/dev/vda1" } } } }

      it "raises an error" do
        expect { subject.convert }.to raise_error(
          Agama::Storage::ConfigConversions::FromJSONConversions::UnsupportedSearchCondition
        )
      end
    end
  end
end

shared_examples "a search converter supporting operators" do
  context "if an 'and' operator is specified" do
    let(:condition) do
      { and: [{ name: "/dev/vda" }, { size: { less: "1 TiB" } }] }
    end

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::And)

      conditions = config.condition.conditions
      expect(conditions.size).to eq(2)

      expect(conditions[0]).to be_a(Agama::Storage::Configs::SearchConditions::Name)
      expect(conditions[0].name).to eq("/dev/vda")

      expect(conditions[1]).to be_a(Agama::Storage::Configs::SearchConditions::Size)
      expect(conditions[1].value).to eq(1.TiB)
      expect(conditions[1].operator).to eq(:less)
    end
  end

  context "if an 'or' operator is specified" do
    let(:condition) do
      { or: [{ name: "/dev/vda" }, { name: "/dev/vdb" }] }
    end

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Or)

      conditions = config.condition.conditions
      expect(conditions.size).to eq(2)
      expect(conditions).to all(be_a(Agama::Storage::Configs::SearchConditions::Name))
      expect(conditions.map(&:name)).to contain_exactly("/dev/vda", "/dev/vdb")
    end
  end

  context "if a 'not' operator is specified" do
    let(:condition) { { not: { name: "/dev/vda" } } }

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Not)

      inner = config.condition.condition
      expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::Name)
      expect(inner.name).to eq("/dev/vda")
    end
  end

  context "if nested operators are specified" do
    let(:condition) do
      {
        and: [
          { size: { less: "1 TiB" } },
          { not: { name: "/dev/vda" } }
        ]
      }
    end

    it "sets #condition to the expected value" do
      config = subject.convert
      expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::And)

      conditions = config.condition.conditions
      expect(conditions.size).to eq(2)

      expect(conditions[0]).to be_a(Agama::Storage::Configs::SearchConditions::Size)
      expect(conditions[0].value).to eq(1.TiB)
      expect(conditions[0].operator).to eq(:less)

      expect(conditions[1]).to be_a(Agama::Storage::Configs::SearchConditions::Not)
      inner = conditions[1].condition
      expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::Name)
      expect(inner.name).to eq("/dev/vda")
    end
  end

  context "if an unknown condition is nested into an operator" do
    let(:condition) { { not: { whatever: "value" } } }

    it "raises an error" do
      expect { subject.convert }.to raise_error(
        Agama::Storage::ConfigConversions::FromJSONConversions::UnsupportedSearchCondition
      )
    end
  end
end

# Expects the following definition, in addition to the common ones:
#
#   * unsupported_conditions: list of condition JSONs not supported by the device.
shared_examples "a search converter rejecting conditions of other devices" do
  it "raises an error" do
    unsupported_conditions.each do |json|
      converter = described_class.new({ condition: json })
      expect { converter.convert }.to raise_error(
        Agama::Storage::ConfigConversions::FromJSONConversions::UnsupportedSearchCondition
      )
    end
  end

  it "raises an error with an unknown condition" do
    converter = described_class.new({ condition: { whatever: "value" } })
    expect { converter.convert }.to raise_error(
      Agama::Storage::ConfigConversions::FromJSONConversions::UnsupportedSearchCondition
    )
  end
end

shared_examples "a search converter supporting the common sort criteria" do
  context "if 'sort' is specified with a single criterion" do
    let(:sort) { "name" }

    it "sets #sort_criteria to the expected value" do
      criteria = subject.convert.sort_criteria
      expect(criteria.size).to eq(1)
      expect(criteria.first).to be_a(Agama::Storage::Configs::SortCriteria::Name)
      expect(criteria.first.asc?).to eq(true)
    end
  end

  context "if 'sort' is specified with an order" do
    let(:sort) { [{ size: "desc" }] }

    it "sets #sort_criteria to the expected value" do
      criteria = subject.convert.sort_criteria
      expect(criteria.size).to eq(1)
      expect(criteria.first).to be_a(Agama::Storage::Configs::SortCriteria::Size)
      expect(criteria.first.desc?).to eq(true)
    end
  end

  context "if 'sort' is specified with several criteria" do
    let(:sort) { ["size", { name: "desc" }] }

    it "sets #sort_criteria to the expected value" do
      criteria = subject.convert.sort_criteria
      expect(criteria.size).to eq(2)
      expect(criteria[0]).to be_a(Agama::Storage::Configs::SortCriteria::Size)
      expect(criteria[0].asc?).to eq(true)
      expect(criteria[1]).to be_a(Agama::Storage::Configs::SortCriteria::Name)
      expect(criteria[1].desc?).to eq(true)
    end
  end

  context "if 'sort' is specified with an unknown criterion" do
    let(:sort) { ["whatever"] }

    it "raises an error" do
      expect { subject.convert }.to raise_error(
        Agama::Storage::ConfigConversions::FromJSONConversions::UnsupportedSortCriterion
      )
    end
  end
end

shared_examples "a search converter supporting the partition number sort criterion" do
  context "if 'sort' is specified with the 'number' criterion" do
    let(:sort) { ["number"] }

    it "sets #sort_criteria to the expected value" do
      criteria = subject.convert.sort_criteria
      expect(criteria.size).to eq(1)
      expect(criteria.first).to be_a(Agama::Storage::Configs::SortCriteria::PartitionNumber)
    end
  end
end

shared_examples "a search converter rejecting the partition number sort criterion" do
  context "if 'sort' is specified with the 'number' criterion" do
    let(:sort) { ["number"] }

    it "raises an error" do
      expect { subject.convert }.to raise_error(
        Agama::Storage::ConfigConversions::FromJSONConversions::UnsupportedSortCriterion
      )
    end
  end
end
