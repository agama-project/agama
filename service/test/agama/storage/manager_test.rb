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
require_relative "../with_progress_examples"
require_relative "../with_issues_examples"
require_relative "storage_helpers"
require "agama/http/clients"
require "agama/config"
require "agama/http"
require "agama/issue"
require "agama/storage/configurator"
require "agama/storage/iscsi/manager"
require "agama/storage/manager"
require "agama/storage/proposal"
require "agama/storage/proposal_settings"
require "agama/storage/volume"
require "y2storage/issue"
require "y2storage/luks"
require "yast2/fs_snapshot"

Yast.import "Installation"

describe Agama::Storage::Manager do
  include Agama::RSpec::StorageHelpers

  subject(:storage) { described_class.new(config, logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "agama.yaml")
  end
  let(:config) { Agama::Config.from_file(config_path) }
  let(:files_client) { instance_double(Agama::HTTP::Clients::Files, write: nil) }
  let(:scripts_client) { instance_double(Agama::HTTP::Clients::Scripts, run: nil) }
  let(:scripts_dir) { File.join(tmp_dir, "run", "agama", "scripts") }
  let(:tmp_dir) { Dir.mktmpdir }

  before do
    mock_storage(devicegraph: scenario)
    allow(Agama::Storage::Proposal).to receive(:new).and_return(proposal)
    allow(Agama::HTTP::Clients::Questions).to receive(:new).and_return(questions_client)
    allow(Agama::DBus::Clients::Software).to receive(:instance).and_return(software)
    allow(Bootloader::FinishClient).to receive(:new).and_return(bootloader_finish)
    allow(Agama::Security).to receive(:new).and_return(security)
    # mock writting config as proposal call can do storage probing, which fails in CI
    allow_any_instance_of(Agama::Storage::Bootloader).to receive(:write_config)
    allow(Agama::HTTP::Clients::Files).to receive(:new).and_return(files_client)
    allow(Agama::HTTP::Clients::Scripts).to receive(:new).and_return(scripts_client)
    allow(Agama::Network).to receive(:new).and_return(network)
    allow(Yast::Installation).to receive(:destdir).and_return(File.join(tmp_dir, "mnt"))
    stub_const("Agama::Storage::Finisher::CopyLogsStep::SCRIPTS_DIR",
      File.join(tmp_dir, "run", "agama", "scripts"))
  end

  after do
    FileUtils.remove_entry(tmp_dir)
  end

  let(:y2storage_manager) { Y2Storage::StorageManager.instance }
  let(:proposal) { Agama::Storage::Proposal.new(config, logger: logger) }
  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }
  let(:software) do
    instance_double(Agama::DBus::Clients::Software, selected_product: "ALP")
  end
  let(:network) { instance_double(Agama::Network, link_resolv: nil, unlink_resolv: nil) }
  let(:bootloader_finish) { instance_double(Bootloader::FinishClient, write: nil) }
  let(:security) { instance_double(Agama::Security, write: nil) }

  let(:scenario) { "empty-hd-50GiB.yaml" }

  describe "#deprecated_system=" do
    let(:callback) { proc {} }

    context "if the current value is changed" do
      before do
        storage.deprecated_system = true
      end

      it "executes the on_deprecated_system_change callbacks" do
        storage.on_deprecated_system_change(&callback)

        expect(callback).to receive(:call)

        storage.deprecated_system = false
      end
    end

    context "if the current value is not changed" do
      before do
        storage.deprecated_system = true
      end

      it "does not execute the on_deprecated_system_change callbacks" do
        storage.on_deprecated_system_change(&callback)

        expect(callback).to_not receive(:call)

        storage.deprecated_system = true
      end
    end

    context "when the system is set as deprecated" do
      it "marks the system as deprecated" do
        storage.deprecated_system = true

        expect(storage.deprecated_system?).to eq(true)
      end

      it "adds a deprecated system issue" do
        expect(storage.issues).to be_empty

        storage.deprecated_system = true

        expect(storage.issues).to include(
          an_object_having_attributes(description: /system devices have changed/)
        )
      end
    end

    context "when the system is set as not deprecated" do
      it "marks the system as not deprecated" do
        storage.deprecated_system = false

        expect(storage.deprecated_system?).to eq(false)
      end

      it "does not add a deprecated system issue" do
        storage.deprecated_system = false

        expect(storage.issues).to_not include(
          an_object_having_attributes(description: /system devices have changed/)
        )
      end
    end
  end

  describe "#probe" do
    before do
      allow(Agama::Storage::ISCSI::Manager).to receive(:new).and_return(iscsi)
      allow(y2storage_manager).to receive(:raw_probed).and_return(raw_devicegraph)
      allow(proposal).to receive(:issues).and_return(proposal_issues)
      allow(proposal.storage_system).to receive(:candidate_devices).and_return(devices)
      allow(proposal).to receive(:calculate_from_json).and_return(true)
      allow(proposal).to receive(:success?).and_return(true)
      allow(proposal).to receive(:storage_json).and_return(current_config)
      allow_any_instance_of(Agama::Storage::Configurator)
        .to receive(:generate_configs).and_return([default_config])
      allow(config).to receive(:pick_product)
      allow(iscsi).to receive(:activate)
      allow(y2storage_manager).to receive(:activate)
      allow(iscsi).to receive(:probe)
      allow(y2storage_manager).to receive(:probe)
    end

    let(:raw_devicegraph) do
      instance_double(Y2Storage::Devicegraph, probing_issues: probing_issues)
    end

    let(:proposal) { Agama::Storage::Proposal.new(config, logger: logger) }

    let(:default_config) do
      {
        storage: {
          drives: [
            search: "/dev/vda1"
          ]
        }
      }
    end

    let(:current_config) do
      {
        storage: {
          drives: [
            search: "/dev/vda2"
          ]
        }
      }
    end

    let(:iscsi) { Agama::Storage::ISCSI::Manager.new }

    let(:devices) { [disk1, disk2] }

    let(:disk1) { instance_double(Y2Storage::Disk, name: "/dev/vda") }
    let(:disk2) { instance_double(Y2Storage::Disk, name: "/dev/vdb") }

    let(:probing_issues) { [Y2Storage::Issue.new("probing issue")] }

    let(:proposal_issues) { [Agama::Issue.new("proposal issue")] }

    let(:callback) { proc {} }

    it "sets env YAST_NO_BLS_BOOT to yes if product doesn't requires bls boot explicitly" do
      expect(config).to receive(:pick_product)
      expect(config).to receive(:boot_strategy).and_return(nil)
      expect(ENV).to receive(:[]=).with("YAST_NO_BLS_BOOT", "1")

      storage.probe
    end

    it "probes the storage devices and calculates a proposal" do
      expect(config).to receive(:pick_product).with("ALP")
      expect(iscsi).to receive(:activate)
      expect(y2storage_manager).to receive(:activate) do |callbacks|
        expect(callbacks).to be_a(Agama::Storage::Callbacks::Activate)
      end
      expect(iscsi).to receive(:probe)
      expect(y2storage_manager).to receive(:probe)
      expect(proposal).to receive(:calculate_from_json)
      storage.probe
    end

    it "sets the system as non deprecated" do
      storage.deprecated_system = true
      storage.probe

      expect(storage.deprecated_system?).to eq(false)
    end

    it "adds the probing issues" do
      storage.probe

      expect(storage.issues).to include(
        an_object_having_attributes(description: /probing issue/)
      )
    end

    it "adds the proposal issues" do
      storage.probe

      expect(storage.issues).to include(
        an_object_having_attributes(description: /proposal issue/)
      )
    end

    it "executes the on_probe callbacks" do
      storage.on_probe(&callback)

      expect(callback).to receive(:call)

      storage.probe
    end

    context "if :keep_config is false" do
      let(:keep_config) { false }

      it "calculates a proposal using the default product config" do
        expect(proposal).to receive(:calculate_from_json).with(default_config)
        storage.probe(keep_config: keep_config)
      end
    end

    context "if :keep_config is true" do
      let(:keep_config) { true }

      it "calculates a proposal using the current config" do
        expect(proposal).to receive(:calculate_from_json).with(current_config)
        storage.probe(keep_config: keep_config)
      end
    end

    context "if :keep_activation is false" do
      let(:keep_activation) { false }

      it "resets information from previous activation" do
        expect(Y2Storage::Luks).to receive(:reset_activation_infos)
        storage.probe(keep_activation: keep_activation)
      end
    end

    context "if :keep_activation is true" do
      let(:keep_activation) { true }

      it "does not reset information from previous activation" do
        expect(Y2Storage::Luks).to_not receive(:reset_activation_infos)
        storage.probe(keep_activation: keep_activation)
      end
    end

    context "if there are available devices" do
      let(:devices) { [disk1] }

      it "does not add an issue for available devices" do
        storage.probe

        expect(storage.issues).to_not include(
          an_object_having_attributes(description: /no suitable device/)
        )
      end
    end

    context "if there are not available devices" do
      let(:devices) { [] }

      it "adds an issue for available devices" do
        storage.probe

        expect(storage.issues).to include(
          an_object_having_attributes(description: /no suitable device/)
        )
      end
    end
  end

  describe "#configure" do
    before do
      allow(proposal).to receive(:issues).and_return(proposal_issues)
      allow(proposal).to receive(:calculate_from_json)
      allow(proposal).to receive(:storage_json).and_return(config_json)
      allow_any_instance_of(Agama::Storage::Configurator)
        .to receive(:generate_configs).and_return([default_config])
    end

    let(:proposal) { Agama::Storage::Proposal.new(config, logger: logger) }

    let(:default_config) do
      {
        storage: {
          drives: [
            search: "/dev/vda1"
          ]
        }
      }
    end

    let(:config_json) do
      {
        storage: {
          drives: [
            search: "/dev/vda2"
          ]
        }
      }
    end

    let(:proposal_issues) { [Agama::Issue.new("proposal issue")] }

    let(:callback) { proc {} }

    it "calculates a proposal using the default config if no config is given" do
      expect(proposal).to receive(:calculate_from_json).with(default_config)
      storage.configure
    end

    it "calculates a proposal using the given config" do
      expect(proposal).to receive(:calculate_from_json).with(config_json)
      storage.configure(config_json)
    end

    it "adds the proposal issues" do
      storage.configure

      expect(storage.issues).to include(
        an_object_having_attributes(description: /proposal issue/)
      )
    end

    it "executes the on_configure callbacks" do
      storage.on_configure(&callback)
      expect(callback).to receive(:call)
      storage.configure
    end

    context "if the proposal was correctly calculated" do
      before do
        allow(proposal).to receive(:success?).and_return(true)
      end

      it "returns true" do
        expect(storage.configure).to eq(true)
      end
    end

    context "if the proposal was not correctly calculated" do
      before do
        allow(proposal).to receive(:success?).and_return(false)
      end

      it "returns false" do
        expect(storage.configure).to eq(false)
      end
    end
  end

  describe "#install" do
    before do
      allow(y2storage_manager).to receive(:staging).and_return(proposed_devicegraph)

      allow(Yast::WFM).to receive(:CallFunction).with("inst_prepdisk", [])
      allow(Yast::WFM).to receive(:CallFunction).with("inst_bootloader", [])
      allow(Yast::PackagesProposal).to receive(:SetResolvables)
      allow(Bootloader::ProposalClient).to receive(:new)
        .and_return(bootloader_proposal)
      allow(Y2Storage::Clients::InstPrepdisk).to receive(:new).and_return(client)
    end

    let(:proposed_devicegraph) do
      instance_double(Y2Storage::Devicegraph, used_features: used_features)
    end

    let(:used_features) do
      instance_double(
        Y2Storage::StorageFeaturesList,
        pkg_list: ["btrfsprogs", "snapper"],
        any?:     false
      )
    end

    let(:bootloader_proposal) { instance_double(Bootloader::ProposalClient, make_proposal: nil) }

    let(:client) { instance_double(Y2Storage::Clients::InstPrepdisk, run: nil) }

    it "adds storage software to install" do
      expect(Yast::PackagesProposal).to receive(:SetResolvables) do |_, _, packages|
        expect(packages).to contain_exactly("btrfsprogs", "snapper")
      end

      storage.install
    end

    it "runs the inst_prepdisk client" do
      expect(Y2Storage::Clients::InstPrepdisk).to receive(:new) do |params|
        expect(params[:commit_callbacks]).to be_a(Agama::Storage::Callbacks::Commit)
      end.and_return(client)

      expect(client).to receive(:run)

      storage.install
    end

    context "if iSCSI was configured" do
      before do
        allow_any_instance_of(Agama::Storage::ISCSI::Manager)
          .to receive(:configured?).and_return(true)
      end

      it "adds the iSCSI software to install" do
        expect(Yast::PackagesProposal).to receive(:SetResolvables) do |_, _, packages|
          expect(packages).to include("open-iscsi", "iscsiuio")
        end

        storage.install
      end
    end

    context "if iSCSI was used" do
      before do
        allow_any_instance_of(Agama::Storage::ISCSI::Manager)
          .to receive(:configured?).and_return(false)
      end

      let(:used_features) do
        instance_double(Y2Storage::StorageFeaturesList, pkg_list: [], any?: true)
      end

      it "adds the iSCSI software to install" do
        expect(Yast::PackagesProposal).to receive(:SetResolvables) do |_, _, packages|
          expect(packages).to include("open-iscsi", "iscsiuio")
        end

        storage.install
      end
    end
  end

  describe "#proposal" do
    it "returns an instance of the Storage::Proposal class" do
      expect(storage.proposal).to be_a(Agama::Storage::Proposal)
    end
  end

  describe "#finish" do
    before do
      allow(File).to receive(:directory?).and_call_original
      allow(copy_files_class).to receive(:new).and_return(copy_files)
      allow(Yast::Execute).to receive(:on_target!)
      allow(Yast::Execute).to receive(:local)
      allow(Yast2::FsSnapshot).to receive(:configure_on_install?).and_return true
      allow(Yast2::FsSnapshot).to receive(:configure_snapper)
    end
    let(:copy_files_class) { Agama::Storage::Finisher::CopyFilesStep }
    let(:copy_files) { instance_double(copy_files_class, run?: true, run: true, label: "Copy") }

    let(:scenario) { "staging-plain-partitions.yaml" }

    it "copy needed files, installs the bootloader, sets up the snapshots, " \
       "copy logs, symlink resolv.conf, runs the post-installation scripts, " \
       "unlink resolv.conf, and umounts the file systems" do
      expect(security).to receive(:write)
      expect(copy_files).to receive(:run)
      expect(bootloader_finish).to receive(:write)
      expect(Yast::WFM).to receive(:CallFunction).with("storage_finish", ["Write"])
      expect(Yast::WFM).to receive(:CallFunction).with("iscsi-client_finish", ["Write"])
      expect(Yast2::FsSnapshot).to receive(:configure_snapper)
      expect(network).to receive(:link_resolv)
      expect(scripts_client).to receive(:run).with("post")
      expect(files_client).to receive(:write)
      expect(network).to receive(:unlink_resolv)
      expect(Yast::Execute).to receive(:on_target!)
        .with("systemctl", "enable", "agama-scripts", allowed_exitstatus: [0, 1])
      expect(Yast::WFM).to receive(:CallFunction).with("umount_finish", ["Write"])
      expect(Yast::Execute).to receive(:locally).with(
        "agama", "logs", "store", "--destination", /\/var\/log\/agama-installation\/logs/
      )
      storage.finish
    end

    context "when scripts artifacts exist" do
      before do
        FileUtils.mkdir_p(scripts_dir)
        FileUtils.touch(File.join(scripts_dir, "test.sh"))
        allow(Yast::Execute).to receive("locally").with("agama", "logs", "store", any_args)
      end

      it "copies the artifacts to the installed system" do
        storage.finish
        expect(File).to exist(File.join(tmp_dir, "mnt", "var", "log", "agama-installation",
          "scripts"))
      end
    end
  end

  describe "#actions" do
    it "return an empty list if the system has not been probed yet" do
      expect(subject.actions).to eq([])
    end

    context "if the system was probed" do
      before do
        mock_storage(devicegraph: "partitioned_md.yml")

        subject.proposal.calculate_guided(settings)
      end

      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap do |settings|
          settings.device.name = "/dev/sdb"
          settings.volumes = [Agama::Storage::Volume.new("/")]
        end
      end

      it "returns the list of actions" do
        expect(subject.actions).to include(
          an_object_having_attributes(text: /Create partition \/dev\/sdb1/)
        )
      end
    end
  end

  include_examples "progress"

  include_examples "issues"
end
