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

require_relative "../../../../test_helper"
require "agama/storage/config_conversions"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

shared_examples "without search" do
  context "if #search is not configured" do
    let(:search) { nil }

    it "generates the expected JSON for 'search'" do
      config_json = subject.convert
      expect(config_json.keys).to_not include(:search)
    end
  end
end

shared_examples "without alias" do
  context "if #alias is not configured" do
    let(:device_alias) { nil }

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json.keys).to_not include(:alias)
    end
  end
end

shared_examples "without encryption" do
  context "if #encryption is not configured" do
    let(:encryption) { nil }

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json.keys).to_not include(:encryption)
    end
  end
end

shared_examples "without filesystem" do
  context "if #filesystem is not configured" do
    let(:filesystem) { nil }

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json.keys).to_not include(:filesystem)
    end
  end
end

shared_examples "without ptable_type" do
  context "if #ptable_type is not configured" do
    let(:ptable_type) { nil }

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json.keys).to_not include(:ptableType)
    end
  end
end

shared_examples "without partitions" do
  context "if #partitions is not configured" do
    let(:partitions) { nil }

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json.keys).to_not include(:partitions)
    end
  end
end

shared_examples "without size" do
  context "if #size is not configured" do
    let(:size) { nil }

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json.keys).to_not include(:size)
    end
  end
end

shared_examples "with search" do
  context "if #search is configured" do
    let(:search) do
      {
        condition:  { name: "/dev/vda1" },
        ifNotFound: "skip",
        max:        2
      }
    end

    it "generates the expected JSON" do
      config_json = subject.convert
      search_json = config_json[:search]

      expect(search_json).to eq(
        {
          condition:  { name: "/dev/vda1" },
          ifNotFound: "skip",
          max:        2
        }
      )
    end
  end
end

shared_examples "with alias" do
  context "if #alias is configured" do
    let(:device_alias) { "test" }

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json[:alias]).to eq("test")
    end
  end
end

shared_examples "with encryption" do
  context "if #encryption is configured" do
    let(:encryption) do
      {
        luks2: {
          password:     "12345",
          keySize:      256,
          pbkdFunction: "argon2i",
          cipher:       "twofish",
          label:        "test"
        }
      }
    end

    it "generates the expected JSON" do
      config_json = subject.convert
      encryption_json = config_json[:encryption]

      expect(encryption_json).to eq(
        {
          luks2: {
            password:     "12345",
            keySize:      256,
            pbkdFunction: "argon2i",
            cipher:       "twofish",
            label:        "test"
          }
        }
      )
    end

    context "if encryption only configures #password" do
      let(:encryption) do
        {
          luks2: {
            password: "12345"
          }
        }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        encryption_json = config_json[:encryption]

        expect(encryption_json).to eq(
          {
            luks2: {
              password: "12345"
            }
          }
        )
      end
    end

    context "if encryption method is pervasive LUKS2" do
      let(:encryption) do
        {
          pervasiveLuks2: {
            password: "12345"
          }
        }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        encryption_json = config_json[:encryption]

        expect(encryption_json).to eq(
          {
            pervasiveLuks2: {
              password: "12345"
            }
          }
        )
      end
    end

    context "if encryption method is TMP FDE" do
      let(:encryption) do
        {
          tpmFde: {
            password: "12345"
          }
        }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        encryption_json = config_json[:encryption]

        expect(encryption_json).to eq(
          {
            tpmFde: {
              password: "12345"
            }
          }
        )
      end
    end

    context "if encryption method is protected swap" do
      let(:encryption) { "protected_swap" }

      it "generates the expected JSON" do
        config_json = subject.convert
        encryption_json = config_json[:encryption]

        expect(encryption_json).to eq("protected_swap")
      end
    end

    context "if encryption method is not configured" do
      let(:encryption) { {} }

      it "generates the expected JSON" do
        config_json = subject.convert
        encryption_json = config_json[:encryption]
        expect(encryption_json).to be_nil
      end
    end
  end
end

shared_examples "with filesystem" do
  context "if #encryption is configured" do
    let(:filesystem) do
      {
        reuseIfPossible: true,
        type:            "xfs",
        label:           "test",
        path:            "/test",
        mountBy:         "device",
        mkfsOptions:     ["version=2"],
        mountOptions:    ["rw"]
      }
    end

    it "generates the expected JSON" do
      config_json = subject.convert
      filesystem_json = config_json[:filesystem]

      expect(filesystem_json).to eq(
        {
          reuseIfPossible: true,
          type:            "xfs",
          label:           "test",
          path:            "/test",
          mountBy:         "device",
          mkfsOptions:     ["version=2"],
          mountOptions:    ["rw"]
        }
      )
    end

    context "if filesystem configures #btrfs" do
      let(:filesystem) do
        {
          type: {
            btrfs: {
              snapshots: true
            }
          }
        }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        filesystem_json = config_json[:filesystem]

        expect(filesystem_json).to eq(
          {
            reuseIfPossible: false,
            type:            {
              btrfs: { snapshots: true }
            },
            mkfsOptions:     [],
            mountOptions:    []
          }
        )
      end
    end

    context "if filesystem does not configure #type" do
      let(:filesystem) { {} }

      it "generates the expected JSON" do
        config_json = subject.convert
        filesystem_json = config_json[:filesystem]

        expect(filesystem_json).to eq(
          {
            reuseIfPossible: false,
            mkfsOptions:     [],
            mountOptions:    []
          }
        )
      end
    end
  end
end

shared_examples "with ptable_type" do
  context "if #ptable_type is configured" do
    let(:ptable_type) { "gpt" }

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json[:ptableType]).to eq("gpt")
    end
  end
end

shared_examples "with size" do
  context "if #size is configured" do
    let(:size) do
      {
        min: "1 GiB",
        max: "10 GiB"
      }
    end

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json[:size]).to eq(
        {
          min: 1.GiB.to_i,
          max: 10.GiB.to_i
        }
      )
    end

    context "if min size is not configured" do
      let(:size) do
        {
          min: "1 GiB",
          max: "10 GiB"
        }
      end

      before do
        config.size.min = nil
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:size]).to eq(
          {
            min: "current",
            max: 10.GiB.to_i
          }
        )
      end
    end

    context "if max size is unlimited" do
      let(:size) do
        {
          min: "1 GiB"
        }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:size]).to eq(
          {
            min: 1.GiB.to_i
          }
        )
      end
    end

    context "if max size is not configured" do
      let(:size) do
        {
          min: "1 GiB"
        }
      end

      before do
        config.size.max = nil
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:size]).to eq(
          {
            min: 1.GiB.to_i,
            max: "current"
          }
        )
      end
    end

    context "if size is default" do
      before do
        size_config = config.size
        size_config.default = true
        size_config.min = 5.GiB
        size_config.max = 25.GiB
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:size)
      end
    end
  end
end

shared_examples "with partitions" do
  context "if #partitions is configured" do
    let(:partitions) do
      [
        { alias: "p1" },
        { alias: "p2" }
      ]
    end

    it "generates the expected JSON" do
      config_json = subject.convert
      partitions_json = config_json[:partitions]

      expect(partitions_json).to eq(
        [
          { alias: "p1" },
          { alias: "p2" }
        ]
      )
    end
  end
end
