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

require_relative "./storage_helpers"
require "agama/config"
require "agama/storage/config_conversions/from_json"
require "agama/storage/config_checker"
require "agama/storage/config_solver"
require "y2storage"

shared_examples "encryption issues" do
  let(:filesystem) { nil }

  context "without password" do
    let(:encryption) do
      { luks1: {} }
    end

    it "includes the expected issue" do
      issues = subject.issues
      expect(issues.size).to eq(1)

      issue = issues.first
      expect(issue.error?).to eq(true)
      expect(issue.description).to match("No passphrase")
    end
  end

  context "with unavailable method" do
    let(:encryption) do
      {
        pervasiveLuks2: {
          password: "12345"
        }
      }
    end

    before do
      allow_any_instance_of(Y2Storage::EncryptionMethod::PervasiveLuks2)
        .to(receive(:available?))
        .and_return(false)
    end

    it "includes the expected issue" do
      issues = subject.issues
      expect(issues.size).to eq(1)

      issue = issues.first
      expect(issue.error?).to eq(true)
      expect(issue.description).to match("'Pervasive Volume Encryption' is not available")
    end
  end

  context "with invalid method" do
    let(:encryption) { "protected_swap" }
    let(:filesystem) { { path: "/" } }

    before do
      allow_any_instance_of(Y2Storage::EncryptionMethod::ProtectedSwap)
        .to(receive(:available?))
        .and_return(true)
    end

    it "includes the expected issue" do
      issues = subject.issues
      expect(issues.size).to eq(1)

      issue = issues.first
      expect(issue.error?).to eq(true)
      expect(issue.description)
        .to(match("'Encryption with Volatile Protected Key' is not a suitable"))
    end
  end

  context "with a valid encryption" do
    let(:encryption) do
      {
        luks1: {
          password: "12345"
        }
      }
    end

    let(:filesystem) { { path: "/" } }

    it "does not include an issue" do
      expect(subject.issues.size).to eq(0)
    end
  end
end

shared_examples "filesystem issues" do |filesystem_proc|
  context "with invalid type" do
    let(:filesystem) do
      {
        path:            "/",
        type:            "vfat",
        reuseIfPossible: reuse
      }
    end

    context "and without reusing the filesystem" do
      let(:reuse) { false }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues.size).to eq(1)

        issue = issues.first
        expect(issue.error?).to eq(true)
        expect(issue.description).to match("type 'FAT' is not suitable for '/'")
      end
    end

    context "and reusing the filesystem" do
      let(:reuse) { true }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end
  end

  context "with valid type" do
    let(:filesystem) do
      {
        path: "/",
        type: "btrfs"
      }
    end

    it "does not include an issue" do
      expect(subject.issues.size).to eq(0)
    end
  end

  context "without a filesystem type" do
    let(:filesystem) do
      {
        path:            "/",
        reuseIfPossible: reuse
      }
    end

    before do
      # Explicitly remove the filesystem type. Otherwise the JSON conversion assigns a default type.
      filesystem_proc.call(config).type = nil
    end

    context "and without reusing the filesystem" do
      let(:reuse) { false }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues.size).to eq(1)

        issue = issues.first
        expect(issue.error?).to eq(true)
        expect(issue.description).to eq("Missing file system type for '/'")
      end
    end

    context "and reusing the filesystem" do
      let(:reuse) { true }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end
  end
end

describe Agama::Storage::ConfigChecker do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new(config, product_config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  let(:config_json) { nil }

  let(:product_config) { Agama::Config.new(product_data) }

  let(:product_data) do
    {
      "storage" => {
        "volume_templates" => [
          {
            "mount_path" => "/",
            "filesystem" => "btrfs",
            "outline"    => { "filesystems" => ["btrfs", "xfs"] }
          }
        ]
      }
    }
  end

  before do
    mock_storage(devicegraph: scenario)
    # To speed-up the tests
    allow(Y2Storage::EncryptionMethod::TPM_FDE)
      .to(receive(:possible?))
      .and_return(true)
  end

  describe "#issues" do
    before do
      # Solves the config before checking.
      devicegraph = Y2Storage::StorageManager.instance.probed

      Agama::Storage::ConfigSolver
        .new(devicegraph, product_config)
        .solve(config)
    end

    let(:scenario) { "disks.yaml" }

    context "if a drive has not found device" do
      let(:config_json) do
        {
          drives: [
            {
              search: {
                condition:  { name: "/dev/vdd" },
                ifNotFound: if_not_found
              }
            }
          ]
        }
      end

      context "and the drive should be skipped" do
        let(:if_not_found) { "skip" }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues.size).to eq(1)

          issue = issues.first
          expect(issue.error?).to eq(false)
          expect(issue.description).to eq("No device found for an optional drive")
        end
      end

      context "and the drive should not be skipped" do
        let(:if_not_found) { "error" }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues.size).to eq(1)

          issue = issues.first
          expect(issue.error?).to eq(true)
          expect(issue.description).to eq("No device found for a mandatory drive")
        end
      end
    end

    context "if a drive has a found device" do
      let(:config_json) do
        {
          drives: [
            { search: "/dev/vda" }
          ]
        }
      end

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end

    context "if a drive has encryption" do
      let(:config_json) do
        {
          drives: [
            {
              encryption: encryption,
              filesystem: filesystem
            }
          ]
        }
      end

      include_examples "encryption issues"
    end

    context "if a drive has filesystem" do
      let(:config_json) do
        {
          drives: [
            {
              filesystem: filesystem
            }
          ]
        }
      end

      filesystem_proc = proc { |c| c.drives.first.filesystem }

      include_examples "filesystem issues", filesystem_proc
    end

    context "if a drive has partitions" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [partition]
            }
          ]
        }
      end

      context "and a partition has not found device" do
        let(:partition) do
          {
            search: {
              condition:  { name: "/dev/vdb1" },
              ifNotFound: if_not_found
            }
          }
        end

        context "and the partition should be skipped" do
          let(:if_not_found) { "skip" }

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues.size).to eq(1)

            issue = issues.first
            expect(issue.error?).to eq(false)
            expect(issue.description).to eq("No device found for an optional partition")
          end
        end

        context "and the partition should not be skipped" do
          let(:if_not_found) { "error" }

          it "includes the expected issue" do
            issues = subject.issues
            expect(issues.size).to eq(1)

            issue = issues.first
            expect(issue.error?).to eq(true)
            expect(issue.description).to eq("No device found for a mandatory partition")
          end
        end
      end

      context "and the partition has a found device" do
        let(:partition) do
          { search: "/dev/vda1" }
        end

        it "does not include an issue" do
          expect(subject.issues.size).to eq(0)
        end
      end

      context "if a partition has filesystem" do
        let(:partition) do
          { filesystem: filesystem }
        end

        filesystem_proc = proc { |c| c.drives.first.partitions.first.filesystem }

        include_examples "filesystem issues", filesystem_proc
      end

      context "and a partition has encryption" do
        let(:partition) do
          {
            encryption: encryption,
            filesystem: filesystem
          }
        end

        include_examples "encryption issues"
      end
    end

    context "if a volume group has logical volumes" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              logicalVolumes: [
                logical_volume,
                {
                  alias: "pool",
                  pool:  true
                }
              ]
            }
          ]
        }
      end

      context "if a logical volume has filesystem" do
        let(:logical_volume) do
          { filesystem: filesystem }
        end

        filesystem_proc = proc { |c| c.volume_groups.first.logical_volumes.first.filesystem }

        include_examples "filesystem issues", filesystem_proc
      end

      context "and a logical volume has encryption" do
        let(:logical_volume) do
          {
            encryption: encryption,
            filesystem: filesystem
          }
        end

        include_examples "encryption issues"
      end

      context "and a logical volume has an unknown pool" do
        let(:logical_volume) do
          { usedPool: "unknown" }
        end

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues.size).to eq(1)

          issue = issues.first
          expect(issue.error?).to eq(true)
          expect(issue.description).to match("no LVM thin pool")
        end
      end

      context "and a logical volume has a known pool" do
        let(:logical_volume) do
          { usedPool: "pool" }
        end

        it "does not include an issue" do
          expect(subject.issues.size).to eq(0)
        end
      end
    end

    context "if a volume group has an unknown physical volume" do
      let(:config_json) do
        {
          drives:       [
            {
              alias: "first-disk"
            }
          ],
          volumeGroups: [
            {
              physicalVolumes: ["first-disk", "pv1"]
            }
          ]
        }
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues.size).to eq(1)

        issue = issues.first
        expect(issue.error?).to eq(true)
        expect(issue.description).to match("no LVM physical volume with alias 'pv1'")
      end
    end

    context "if a volume group has an unknown target device for physical volumes" do
      let(:config_json) do
        {
          drives:       [
            {
              alias: "first-disk"
            }
          ],
          volumeGroups: [
            {
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["first-disk", "second-disk"]
                  }
                }
              ]
            }
          ]
        }
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues.size).to eq(1)

        issue = issues.first
        expect(issue.error?).to eq(true)
        expect(issue.description)
          .to(match("no target device for LVM physical volumes with alias 'second-disk'"))
      end
    end

    context "if a volume group has encryption for physical volumes" do
      let(:config_json) do
        {
          drives:       [
            {
              alias: "first-disk"
            }
          ],
          volumeGroups: [
            {
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["first-disk"],
                    encryption:    encryption
                  }
                }
              ]
            }
          ]
        }
      end

      context "without password" do
        let(:encryption) do
          { luks1: {} }
        end

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues.size).to eq(1)

          issue = issues.first
          expect(issue.error?).to eq(true)
          expect(issue.description).to match("No passphrase")
        end
      end

      context "with unavailable method" do
        let(:encryption) do
          {
            luks2: {
              password: "12345"
            }
          }
        end

        before do
          allow_any_instance_of(Y2Storage::EncryptionMethod::Luks2)
            .to(receive(:available?))
            .and_return(false)
        end

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues.size).to eq(1)

          issue = issues.first
          expect(issue.error?).to eq(true)
          expect(issue.description).to match("'Regular LUKS2' is not available")
        end
      end

      context "with invalid method" do
        let(:encryption) { "random_swap" }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues.size).to eq(1)

          issue = issues.first
          expect(issue.error?).to eq(true)
          expect(issue.description)
            .to(match("'Encryption with Volatile Random Key' is not a suitable method"))
        end
      end

      context "with a valid encryption" do
        let(:encryption) do
          {
            luks1: {
              password: "12345"
            }
          }
        end

        it "does not include an issue" do
          expect(subject.issues.size).to eq(0)
        end
      end
    end

    context "if there are overused physical volumes devices" do
      let(:config_json) do
        {
          drives:       [
            { alias: "disk1" },
            { alias: "disk2" },
            { alias: "disk3" }
          ],
          volumeGroups: [
            {
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["disk1", "disk2"]
                  }
                }
              ]
            },
            {
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["disk2"]
                  }
                }
              ]
            },
            {
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["disk1", "disk3", "disk3"]
                  }
                }
              ]
            }
          ]
        }
      end

      it "includes the expected issues" do
        issues = subject.issues
        expect(issues.size).to eq(1)

        issue = issues.first
        expect(issue.error?).to eq(true)
        expect(issue.description).to(match("The device 'disk1' is used several times"))
      end
    end

    context "if the config has several issues" do
      let(:config_json) do
        {
          drives:       [
            {
              search:     "/dev/vdd",
              encryption: { luks2: {} }
            }
          ],
          volumeGroups: [
            {
              physicalVolumes: ["pv1"]
            }
          ]
        }
      end

      it "includes the expected issues" do
        expect(subject.issues).to contain_exactly(
          an_object_having_attributes(
            description: match(/No device found for a mandatory drive/)
          ),
          an_object_having_attributes(
            description: match(/No passphrase provided/)
          ),
          an_object_having_attributes(
            description: match(/There is no LVM physical volume with alias 'pv1'/)
          )
        )
      end
    end
  end
end
