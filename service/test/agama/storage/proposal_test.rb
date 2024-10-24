# frozen_string_literal: true

# Copyright (c) [2022-2024] SUSE LLC
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

  describe "#storage_json" do
    context "if no proposal has been calculated yet" do
      it "returns an empty hash" do
        expect(subject.calculated?).to eq(false)
        expect(proposal.storage_json).to eq({})
      end
    end

    context "if a proposal was calculated with the guided strategy" do
      before do
        subject.calculate_guided(Agama::Storage::ProposalSettings.new)
      end

      it "returns the solved guided JSON config" do
        expected_json = {
          storage: {
            guided: {
              boot:    {
                configure: true
              },
              space:   {
                policy: "keep"
              },
              target:  {
                disk: "/dev/sda"
              },
              volumes: []
            }
          }
        }

        expect(subject.storage_json).to eq(expected_json)
      end
    end

    context "if a proposal was calculated with the agama strategy" do
      before do
        subject.calculate_agama(achivable_config)
      end

      context "and unsolved config is requested" do
        let(:solved) { false }

        it "returns the unsolved JSON config" do
          expect(subject.storage_json(solved: solved)).to eq(
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
                volumeGroups: []
              }
            }
          )
        end
      end

      context "and solved config is requested" do
        let(:solved) { true }

        it "returns the solved JSON config" do
          expect(subject.storage_json(solved: solved)).to eq(
            {
              storage: {
                boot:         { configure: true },
                drives:       [
                  {
                    search:     {
                      condition:  { name: "/dev/sda" },
                      ifNotFound: "error",
                      max:        1
                    },
                    partitions: [
                      {
                        filesystem: {
                          reuseIfPossible: false,
                          path:            "/",
                          type:            {
                            btrfs: { snapshots: false }
                          },
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
                volumeGroups: []
              }
            }
          )
        end
      end
    end

    context "if a proposal was calculated from guided JSON config" do
      before do
        subject.calculate_from_json(config_json)
      end

      let(:config_json) do
        {
          storage: {
            guided: {
              target: {
                disk: "/dev/vda"
              }
            }
          }
        }
      end

      context "and unsolved config is requested" do
        let(:solved) { false }

        it "returns the given guided JSON config" do
          expect(subject.storage_json(solved: solved)).to eq(config_json)
        end
      end

      context "and solved config is requested" do
        let(:solved) { true }

        it "returns the solved guided JSON config" do
          expected_json = {
            storage: {
              guided: {
                boot:    {
                  configure: true
                },
                space:   {
                  policy: "keep"
                },
                target:  {
                  disk: "/dev/vda"
                },
                volumes: []
              }
            }
          }

          expect(subject.storage_json(solved: solved)).to eq(expected_json)
        end
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

      context "and unsolved config is requested" do
        let(:solved) { false }

        it "returns the given JSON config" do
          expect(subject.storage_json(solved: solved)).to eq(config_json)
        end
      end

      context "and solved config is requested" do
        let(:solved) { true }

        it "returns the solved JSON config" do
          expect(subject.storage_json(solved: solved)).to eq(
            {
              storage: {
                boot:         { configure: false },
                drives:       [
                  {
                    search:     {
                      condition:  { name: "/dev/sda" },
                      ifNotFound: "error",
                      max:        1
                    },
                    filesystem: {
                      mkfsOptions:     [],
                      mountOptions:    [],
                      reuseIfPossible: false,
                      type:            {
                        btrfs: { snapshots: false }
                      }
                    },
                    partitions: []
                  }
                ],
                volumeGroups: []
              }
            }
          )
        end
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

  shared_examples "check proposal callbacks" do |action, settings|
    it "runs all the callbacks" do
      callback1 = proc {}
      callback2 = proc {}

      subject.on_calculate(&callback1)
      subject.on_calculate(&callback2)

      expect(callback1).to receive(:call)
      expect(callback2).to receive(:call)

      subject.public_send(action, send(settings))
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

      it "does not run the callbacks" do
        callback1 = proc {}
        callback2 = proc {}

        subject.on_calculate(&callback1)
        subject.on_calculate(&callback2)

        expect(callback1).to_not receive(:call)
        expect(callback2).to_not receive(:call)

        subject.public_send(action, send(settings))
      end

      it "returns false" do
        result = subject.public_send(action, send(settings))
        expect(result).to eq(false)
      end
    end
  end

  describe "#calculate_guided" do
    before do
      mock_storage(devicegraph: "partitioned_md.yml")
    end

    let(:achivable_settings) do
      Agama::Storage::ProposalSettings.new.tap do |settings|
        settings.device.name = "/dev/sdb"
        settings.boot.device = "/dev/sda"
        settings.volumes = [Agama::Storage::Volume.new("/")]
      end
    end

    let(:impossible_settings) do
      Agama::Storage::ProposalSettings.new.tap do |settings|
        settings.device.name = "/dev/sdb"
        settings.volumes = [
          # The boot disk size is 500 GiB, so it cannot accomodate a 1 TiB volume.
          Agama::Storage::Volume.new("/").tap { |v| v.min_size = Y2Storage::DiskSize.TiB(1) }
        ]
      end
    end

    it "calculates a proposal with the guided strategy and with the given settings" do
      expect(Y2Storage::StorageManager.instance.proposal).to be_nil

      subject.calculate_guided(achivable_settings)

      expect(Y2Storage::StorageManager.instance.proposal).to_not be_nil
      y2storage_settings = Y2Storage::StorageManager.instance.proposal.settings
      expect(y2storage_settings.root_device).to eq("/dev/sda")
      expect(y2storage_settings.volumes).to contain_exactly(
        an_object_having_attributes(mount_point: "/", device: "/dev/sdb")
      )
    end

    include_examples "check proposal callbacks", :calculate_guided, :achivable_settings

    include_examples "check proposal return",
      :calculate_guided, :achivable_settings, :impossible_settings

    include_examples "check early proposal", :calculate_guided, :achivable_settings

    context "if the given device settings sets a disk as target" do
      before do
        achivable_settings.device = Agama::Storage::DeviceSettings::Disk.new
      end

      context "and the target disk is not indicated" do
        before do
          achivable_settings.device.name = nil
        end

        it "sets the first available device as target device for volumes" do
          subject.calculate_guided(achivable_settings)
          y2storage_settings = Y2Storage::StorageManager.instance.proposal.settings

          expect(y2storage_settings.volumes).to contain_exactly(
            an_object_having_attributes(mount_point: "/", device: "/dev/sda")
          )
        end
      end
    end

    context "if the given device settings sets a new LVM volume group as target" do
      before do
        achivable_settings.device = Agama::Storage::DeviceSettings::NewLvmVg.new
      end

      context "and the target disks for physical volumes are not indicated" do
        before do
          achivable_settings.device.candidate_pv_devices = []
        end

        it "sets the first available device as candidate device" do
          subject.calculate_guided(achivable_settings)
          y2storage_settings = Y2Storage::StorageManager.instance.proposal.settings

          expect(y2storage_settings.candidate_devices).to contain_exactly("/dev/sda")
        end
      end
    end
  end

  describe "#calculate_agama" do
    it "calculates a proposal with the agama strategy and with the given config" do
      expect(Y2Storage::StorageManager.instance.proposal).to be_nil

      subject.calculate_agama(achivable_config)

      expect(Y2Storage::StorageManager.instance.proposal).to be_a(Y2Storage::AgamaProposal)
    end

    include_examples "check proposal callbacks", :calculate_agama, :achivable_config

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

    include_examples "check proposal callbacks", :calculate_autoyast, :achivable_settings

    include_examples "check proposal return",
      :calculate_autoyast, :achivable_settings, :impossible_settings

    include_examples "check early proposal", :calculate_autoyast, :achivable_settings
  end

  describe "#calculate_from_json" do
    context "if the JSON contains storage guided settings" do
      let(:config_json) do
        {
          storage: {
            guided: {
              target: {
                disk: "/dev/vda"
              }
            }
          }
        }
      end

      it "calculates a proposal with the guided strategy and with the expected settings" do
        expect(subject).to receive(:calculate_guided) do |settings|
          expect(settings).to be_a(Agama::Storage::ProposalSettings)
          expect(settings.device.name).to eq("/dev/vda")
        end

        subject.calculate_from_json(config_json)
      end
    end

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
          an_object_having_attributes(description: /A problem ocurred/)
        )
      end
    end

    context "if the proposal was calculated with the guided strategy" do
      before do
        mock_storage(devicegraph: "partitioned_md.yml")
      end

      let(:impossible_settings) do
        Agama::Storage::ProposalSettings.new.tap do |settings|
          settings.device.name = "/dev/sdb"
          settings.volumes = [
            # The boot disk size is 500 GiB, so it cannot accomodate a 1 TiB volume.
            Agama::Storage::Volume.new("/").tap { |v| v.min_size = Y2Storage::DiskSize.TiB(1) }
          ]
        end
      end

      context "and the settings does not indicate a target device" do
        before do
          # Avoid to automatically set the first device
          allow(Y2Storage::StorageManager.instance.probed_disk_analyzer)
            .to receive(:candidate_disks).and_return([])
        end

        let(:settings) { impossible_settings.tap { |s| s.device.name = nil } }

        it "includes an error because a device is not selected" do
          subject.calculate_guided(settings)

          expect(subject.issues).to include(
            an_object_having_attributes(description: /No device selected/)
          )

          expect(subject.issues).to_not include(
            an_object_having_attributes(description: /is not found/)
          )

          expect(subject.issues).to_not include(
            an_object_having_attributes(description: /are not found/)
          )
        end
      end

      context "and some installation device is missing in the system" do
        let(:settings) { impossible_settings.tap { |s| s.device.name = "/dev/vdz" } }

        it "includes an error because the device is not found" do
          subject.calculate_guided(settings)

          expect(subject.issues).to include(
            an_object_having_attributes(description: /is not found/)
          )
        end
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

    context "if the proposal was calculated with the guided strategy" do
      before do
        settings = Agama::Storage::ProposalSettings.new
        subject.calculate_guided(settings)
      end

      it "returns true" do
        expect(subject.guided?).to eq(true)
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

  describe "#guided_settings" do
    context "if no proposal has been calculated yet" do
      it "returns nil" do
        expect(subject.calculated?).to eq(false)
        expect(subject.guided_settings).to be_nil
      end
    end

    context "if the proposal was calculated with the guided strategy" do
      before do
        settings = Agama::Storage::ProposalSettings.new
        subject.calculate_guided(settings)
      end

      it "returns the guided settings" do
        expect(subject.guided_settings).to be_a(Agama::Storage::ProposalSettings)
      end
    end

    context "if the proposal was calculated with any other strategy" do
      before do
        subject.calculate_agama(achivable_config)
      end

      it "returns nil" do
        expect(subject.guided_settings).to be_nil
      end
    end
  end
end
