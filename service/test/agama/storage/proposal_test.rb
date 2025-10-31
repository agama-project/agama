# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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

require_relative "../../test_helper"
require_relative "storage_helpers"
require "agama/config"
require "agama/storage/configs"
require "agama/storage/device_settings"
require "agama/storage/proposal"
require "agama/storage/proposal_settings"
require "y2storage"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

def root_partition(size)
  fs_type_config = Agama::Storage::Configs::FilesystemType.new.tap do |t|
    t.fs_type = Y2Storage::Filesystems::Type::BTRFS
  end

  filesystem_config = Agama::Storage::Configs::Filesystem.new.tap do |f|
    f.type = fs_type_config
    f.path = "/"
  end

  size_config = Agama::Storage::Configs::Size.new.tap do |s|
    s.default = false
    s.min = size
    s.max = size
  end

  Agama::Storage::Configs::Partition.new.tap do |p|
    p.filesystem = filesystem_config
    p.size = size_config
  end
end

def drive(partitions)
  Agama::Storage::Configs::Drive.new.tap do |d|
    d.partitions = partitions
  end
end

describe Agama::Storage::Proposal do
  include Agama::RSpec::StorageHelpers

  subject(:proposal) { described_class.new(product_config, logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:product_config) { Agama::Config.new }

  before do
    mock_storage(devicegraph: "empty-hd-50GiB.yaml")
  end

  let(:achivable_config) do
    Agama::Storage::Config.new.tap do |config|
      root = root_partition(Y2Storage::DiskSize.GiB(10))
      drive = drive([root])
      config.drives = [drive]
    end
  end

  let(:impossible_config) do
    Agama::Storage::Config.new.tap do |config|
      root = root_partition(Y2Storage::DiskSize.GiB(100))
      drive = drive([root])
      config.drives = [drive]
    end
  end

  describe "#success?" do
    it "returns false if no calculate has been called yet" do
      expect(subject.success?).to eq(false)
    end

    context "if a proposal was already calculated" do
      before do
        subject.calculate_agama(config)
      end

      context "and the proposal was successful" do
        let(:config) { achivable_config }

        it "returns true" do
          expect(subject.success?).to eq(true)
        end
      end

      context "and the proposal failed" do
        let(:config) { impossible_config }

        it "returns false" do
          expect(subject.success?).to eq(false)
        end
      end
    end
  end

  describe "#default_storage_json" do
    context "if no device is given" do
      it "returns the default JSON config without device" do
        expect(subject.default_storage_json).to eq(
          {
            storage: {
              drives: [
                {
                  search:     nil,
                  partitions: [
                    { generate: "default" }
                  ]
                }
              ]
            }
          }
        )
      end
    end

    context "if a device is given" do
      let(:device) { Y2Storage::StorageManager.instance.probed.disks.first }

      it "returns the default JSON config for the given device" do
        expect(subject.default_storage_json(device)).to eq(
          {
            storage: {
              drives: [
                {
                  search:     device.name,
                  partitions: [
                    { generate: "default" }
                  ]
                }
              ]
            }
          }
        )
      end
    end
  end

  describe "#storage_json" do
    context "if no proposal has been calculated yet" do
      it "returns nil" do
        expect(subject.calculated?).to eq(false)
        expect(proposal.storage_json).to be_nil
      end
    end

    context "if a proposal was calculated with the agama strategy" do
      before do
        subject.calculate_agama(achivable_config)
      end

      it "returns the unsolved JSON config" do
        expect(subject.storage_json).to eq(
          {
            storage: {
              boot:         { configure: true },
              drives:       [
                {
                  search:     {
                    ifNotFound: "error",
                    max:        1
                  },
                  partitions: [
                    {
                      filesystem: {
                        reuseIfPossible: false,
                        path:            "/",
                        type:            "btrfs",
                        mkfsOptions:     [],
                        mountOptions:    []
                      },
                      size:       {
                        min: 10.GiB.to_i,
                        max: 10.GiB.to_i
                      }
                    }
                  ]
                }
              ],
              mdRaids:      [],
              volumeGroups: []
            }
          }
        )
      end
    end

    context "if a proposal was calculated with the autoyast strategy" do
      before do
        subject.calculate_autoyast(partitioning)
      end

      let(:partitioning) do
        [
          {
            partitions: [
              {
                mount: "/",
                size:  "10 GiB"
              }
            ]
          }
        ]
      end

      it "returns the unsolved JSON config" do
        expect(subject.storage_json).to eq(
          {
            legacyAutoyastStorage: partitioning
          }
        )
      end
    end

    context "if a proposal was calculated from storage JSON config" do
      before do
        subject.calculate_from_json(config_json)
      end

      let(:config_json) do
        {
          storage: {
            boot:   { configure: false },
            drives: [
              {
                filesystem: {
                  type: "btrfs"
                }
              }
            ]
          }
        }
      end

      it "returns the given JSON config" do
        expect(subject.storage_json).to eq(config_json)
      end
    end

    context "if a proposal was calculated from autoyast JSON config" do
      before do
        subject.calculate_from_json(config_json)
      end

      let(:config_json) do
        {
          legacyAutoyastStorage: [
            {
              partitions: [
                {
                  mount: "/",
                  size:  "10 GiB"
                }
              ]
            }
          ]
        }
      end

      it "returns the given autoyast JSON config" do
        expect(subject.storage_json).to eq(config_json)
      end
    end
  end

  describe "#model_json" do
    context "if no proposal has been calculated yet" do
      it "returns nil" do
        expect(subject.model_json).to be_nil
      end
    end

    context "if an AutoYaST proposal has been calculated" do
      before do
        subject.calculate_from_json(autoyast_json)
      end

      let(:autoyast_json) do
        {
          legacyAutoyastStorage: [
            { device: "/dev/vda" }
          ]
        }
      end

      it "returns nil" do
        expect(subject.model_json).to be_nil
      end
    end

    context "if an agama proposal has been calculated" do
      before do
        subject.calculate_from_json(config_json)
      end

      context "and the model does not support the config" do
        let(:config_json) do
          {
            storage: {
              drives: [
                {
                  partitions: [
                    {
                      encryption: { luks1: { password: "12345" } }
                    }
                  ]
                }
              ]
            }
          }
        end

        it "returns nil" do
          expect(subject.model_json).to be_nil
        end
      end

      context "and the config has errors" do
        let(:config_json) do
          {
            storage: {
              drives: [
                { search: "unknown" }
              ]
            }
          }
        end

        it "returns the config model" do
          expect(subject.model_json).to eq(
            {
              boot:         {
                configure: true,
                device:    {
                  default: true
                }
              },
              drives:       [
                {
                  name:        "unknown",
                  spacePolicy: "keep",
                  partitions:  []
                }
              ],
              mdRaids:      [],
              volumeGroups: []
            }
          )
        end
      end

      context "and the config has not errors" do
        let(:config_json) do
          {
            storage: {
              drives: [
                {
                  alias:      "root",
                  partitions: [
                    {
                      filesystem: { path: "/" },
                      encryption: {
                        luks1: { password: "12345" }
                      }
                    }
                  ]
                }
              ]
            }
          }
        end

        it "returns the config model" do
          expect(subject.model_json).to eq(
            {
              boot:         {
                configure: true,
                device:    {
                  default: true,
                  name:    "/dev/sda"
                }
              },
              encryption:   {
                method:   "luks1",
                password: "12345"
              },
              drives:       [
                {
                  name:        "/dev/sda",
                  spacePolicy: "keep",
                  partitions:  [
                    {
                      mountPath:      "/",
                      filesystem:     {
                        reuse:   false,
                        default: true,
                        type:    "ext4"
                      },
                      size:           {
                        default: true,
                        min:     0
                      },
                      delete:         false,
                      deleteIfNeeded: false,
                      resize:         false,
                      resizeIfNeeded: false
                    }
                  ]
                }
              ],
              mdRaids:      [],
              volumeGroups: []
            }
          )
        end
      end
    end
  end

  describe "#solve_model" do
    let(:model) do
      {
        drives: [
          {
            name:       "/dev/sda",
            alias:      "sda",
            partitions: [
              { mountPath: "/" }
            ]
          }
        ]
      }
    end

    it "returns the solved model" do
      result = subject.solve_model(model)

      expect(result).to eq({
        boot:         {
          configure: true,
          device:    {
            default: true,
            name:    "/dev/sda"
          }
        },
        drives:       [
          {
            name:        "/dev/sda",
            spacePolicy: "keep",
            partitions:  [
              {
                mountPath:      "/",
                filesystem:     {
                  reuse:   false,
                  default: true,
                  type:    "ext4"
                },
                size:           {
                  default: true,
                  min:     0
                },
                delete:         false,
                deleteIfNeeded: false,
                resize:         false,
                resizeIfNeeded: false
              }
            ]
          }
        ],
        mdRaids:      [],
        volumeGroups: []
      })
    end

    context "if the system has not been probed yet" do
      before do
        allow(Y2Storage::StorageManager.instance).to receive(:probed?).and_return(false)
      end

      it "returns nil" do
        result = subject.solve_model(model)
        expect(result).to be_nil
      end
    end
  end

  shared_examples "check proposal return" do |action, achivable_settings, impossible_settings|
    it "returns whether the proposal was successful" do
      result = subject.public_send(action, send(achivable_settings))
      expect(result).to eq(true)

      result = subject.public_send(action, send(impossible_settings))
      expect(result).to eq(false)
    end
  end

  shared_examples "check early proposal" do |action, settings|
    context "if the system has not been probed yet" do
      before do
        allow(Y2Storage::StorageManager.instance).to receive(:probed?).and_return(false)
      end

      it "does not calculate a proposal" do
        subject.public_send(action, send(settings))
        expect(Y2Storage::StorageManager.instance.proposal).to be_nil
      end

      it "returns false" do
        result = subject.public_send(action, send(settings))
        expect(result).to eq(false)
      end
    end
  end

  describe "#calculate_agama" do
    it "calculates a proposal with the agama strategy and with the given config" do
      expect(Y2Storage::StorageManager.instance.proposal).to be_nil

      subject.calculate_agama(achivable_config)

      expect(Y2Storage::StorageManager.instance.proposal).to be_a(Y2Storage::AgamaProposal)
    end

    include_examples "check proposal return",
      :calculate_agama, :achivable_config, :impossible_config

    include_examples "check early proposal", :calculate_agama, :achivable_config
  end

  describe "#calculate_autoyast" do
    let(:achivable_settings) do
      [
        {
          partitions: [
            {
              mount: "/",
              size:  "10 GiB"
            }
          ]
        }
      ]
    end

    let(:impossible_settings) do
      [
        {
          device:     "/dev/sdb",
          partitions: [
            {
              mount: "/",
              size:  "10 GiB"
            }
          ]
        }
      ]
    end

    it "calculates a proposal with the autoyast strategy and with the given settings" do
      expect(Y2Storage::StorageManager.instance.proposal).to be_nil

      subject.calculate_autoyast(achivable_settings)
      expect(Y2Storage::StorageManager.instance.proposal).to be_a(Y2Storage::AutoinstProposal)
    end

    include_examples "check proposal return",
      :calculate_autoyast, :achivable_settings, :impossible_settings

    include_examples "check early proposal", :calculate_autoyast, :achivable_settings
  end

  describe "#calculate_from_json" do
    context "if the JSON contains storage settings" do
      let(:config_json) do
        {
          storage: {
            drives: [
              {
                filesystem: {
                  type: "xfs"
                }
              }
            ]
          }
        }
      end

      it "calculates a proposal with the agama strategy and with the expected config" do
        expect(subject).to receive(:calculate_agama) do |config|
          expect(config).to be_a(Agama::Storage::Config)
          expect(config.drives.size).to eq(1)

          drive = config.drives.first
          expect(drive.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::XFS)
        end

        subject.calculate_from_json(config_json)
      end
    end

    context "if the JSON contains autoyast settings" do
      let(:config_json) do
        {
          legacyAutoyastStorage: [
            {
              partitions: [
                {
                  mount: "/",
                  size:  "10 GiB"
                }
              ]
            }
          ]
        }
      end

      it "calculates a proposal with the autoyast strategy and with the given settings" do
        expect(subject).to receive(:calculate_autoyast) do |settings|
          expect(settings).to eq(config_json[:legacyAutoyastStorage])
        end

        subject.calculate_from_json(config_json)
      end
    end

    context "if the JSON does not contain any of the storage settings" do
      let(:config_json) { {} }

      it "raises an error" do
        expect { subject.calculate_from_json(config_json) }.to raise_error(/Invalid JSON/)
      end
    end
  end

  describe "#actions" do
    it "returns an empty list if calculate has not been called yet" do
      expect(subject.actions).to eq([])
    end

    context "if the proposal failed" do
      before do
        subject.calculate_agama(impossible_config)
      end

      it "returns an empty list" do
        expect(subject.actions).to eq([])
      end
    end

    context "if the proposal was successful" do
      before do
        subject.calculate_agama(achivable_config)
      end

      it "returns the actions from the actiongraph" do
        expect(proposal.actions).to include(
          an_object_having_attributes(text: /Create partition \/dev\/sda2/)
        )
      end
    end
  end

  describe "#issues" do
    it "returns an empty list if calculate has not been called yet" do
      expect(subject.issues).to eq([])
    end

    it "returns an empty list if the current proposal is successful" do
      subject.calculate_agama(achivable_config)

      expect(subject.issues).to eq([])
    end

    context "if the current proposal is failed" do
      let(:config) { impossible_config }

      it "includes an error" do
        subject.calculate_agama(config)

        expect(subject.issues).to include(
          an_object_having_attributes(description: /Cannot calculate/)
        )
      end
    end
  end

  describe "#guided?" do
    context "if no proposal has been calculated yet" do
      it "returns false" do
        expect(subject.calculated?).to eq(false)
        expect(subject.guided?).to eq(false)
      end
    end

    context "if the proposal was calculated with any other strategy" do
      before do
        subject.calculate_agama(achivable_config)
      end

      it "returns false" do
        expect(subject.guided?).to eq(false)
      end
    end
  end
end
