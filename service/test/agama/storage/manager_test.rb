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
require "agama/dbus"
require "y2storage/issue"
require "y2storage/luks"
require "yast2/fs_snapshot"
require "yaml"

Yast.import "Installation"

describe Agama::Storage::Manager do
  include Agama::RSpec::StorageHelpers

  subject(:storage) { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "agama.yaml")
  end
  let(:config) { Agama::Config.new(YAML.load_file(config_path)) }
  let(:tmp_dir) { Dir.mktmpdir }
  let(:http_client) { instance_double(Agama::HTTP::Clients::Main) }

  before do
    mock_storage(devicegraph: scenario)
    allow(Agama::Storage::Proposal).to receive(:new).and_return(proposal)
    allow(Agama::HTTP::Clients::Questions).to receive(:new).and_return(questions_client)
    allow(Agama::HTTP::Clients::Main).to receive(:new).and_return(http_client)
    allow(Bootloader::FinishClient).to receive(:new).and_return(bootloader_finish)
    # mock writting config as proposal call can do storage probing, which fails in CI
    allow_any_instance_of(Agama::Storage::Bootloader).to receive(:write_config)
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
  let(:bootloader_finish) { instance_double(Bootloader::FinishClient, write: nil) }
  let(:scenario) { "empty-hd-50GiB.yaml" }

  describe "#activate" do
    before do
      allow(y2storage_manager).to receive(:activate)
    end

    it "activates devices managed by Y2Storage" do
      expect(y2storage_manager).to receive(:activate) do |callbacks|
        expect(callbacks).to be_a(Agama::Storage::Callbacks::Activate)
      end
      storage.activate
    end

    it "does not reset information from previous activation" do
      expect(Y2Storage::Luks).to_not receive(:reset_activation_infos)
      storage.activate
    end
  end

  describe "#reset_activation" do
    it "resets information from previous activation" do
      expect(Y2Storage::Luks).to receive(:reset_activation_infos)
      storage.reset_activation
    end
  end

  describe "#probe" do
    before do
      allow(proposal).to receive(:calculate_from_json).and_return(true)
      allow(proposal).to receive(:success?).and_return(true)
    end

    let(:iscsi) { Agama::Storage::ISCSI::Manager.new }

    it "probes the storage devices" do
      expect(y2storage_manager).to receive(:probe) do |callbacks|
        expect(callbacks).to be_a(Y2Storage::Callbacks::UserProbe)
      end
      storage.probe
    end
  end

  describe "#system_issues" do
    before do
      allow(y2storage_manager).to receive(:raw_probed).and_return(raw_devicegraph)
      allow(proposal.storage_system).to receive(:candidate_devices).and_return(devices)
    end

    let(:raw_devicegraph) do
      instance_double(Y2Storage::Devicegraph, probing_issues: probing_issues)
    end

    let(:devices) { [disk1, disk2] }

    let(:disk1) { instance_double(Y2Storage::Disk, name: "/dev/vda") }
    let(:disk2) { instance_double(Y2Storage::Disk, name: "/dev/vdb") }

    let(:probing_issues) { [Y2Storage::Issue.new("probing issue")] }

    it "includes the probing issues" do
      expect(storage.system_issues).to include(
        an_object_having_attributes(description: /probing issue/)
      )
    end

    context "if there are available devices" do
      let(:devices) { [disk1] }

      it "does not include an issue for available devices" do
        expect(storage.system_issues).to_not include(
          an_object_having_attributes(description: /no suitable device/)
        )
      end
    end

    context "if there are not available devices" do
      let(:devices) { [] }

      it "includes an issue for available devices" do
        expect(storage.system_issues).to include(
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

  describe "#product_config=" do
    it "sets the product config" do
      storage.product_config = config
      expect(storage.product_config).to eq(config)
      expect(storage.proposal.product_config).to eq(config)
    end

    context "if the product does not require bls boot explicitly" do
      before do
        allow(ENV).to receive(:[]=)
      end

      let(:config) { Agama::Config.new({}) }

      it "sets env YAST_NO_BLS_BOOT to yes " do
        expect(ENV).to receive(:[]=).with("YAST_NO_BLS_BOOT", "1")
        storage.product_config = config
      end
    end

    context "if the product requires bls boot explicitly" do
      before do
        allow(ENV).to receive(:[]=)
        allow(ENV).to receive(:[]).with("YAST_NO_BLS_BOOT").and_return("0")
      end

      let(:config) do
        Agama::Config.new({
          "storage" => {
            "boot_strategy" => "BLS"
          }
        })
      end

      it "keeps initial env YAST_NO_BLS_BOOT" do
        expect(ENV).to receive(:[]=).with("YAST_NO_BLS_BOOT", "0")
        storage.product_config = config
      end
    end
  end

  describe "#install" do
    before do
      allow(Yast::WFM).to receive(:CallFunction).with("inst_prepdisk", [])
      allow(Yast::WFM).to receive(:CallFunction).with("inst_bootloader", [])
      allow(Y2Storage::Clients::InstPrepdisk).to receive(:new).and_return(client)
    end

    let(:client) { instance_double(Y2Storage::Clients::InstPrepdisk, run: nil) }

    it "runs the inst_prepdisk client" do
      expect(Y2Storage::Clients::InstPrepdisk).to receive(:new) do |params|
        expect(params[:commit_callbacks]).to be_a(Agama::Storage::Callbacks::Commit)
      end.and_return(client)

      expect(client).to receive(:run)

      storage.install
    end
  end

  describe "#add_packages" do
    before do
      allow(y2storage_manager).to receive(:staging).and_return(proposed_devicegraph)
      allow(Agama::HTTP::Clients::Main).to receive(:new).and_return(http_client)
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

    it "adds storage software to install" do
      expect(http_client).to receive(:set_resolvables)
        .with("storage_proposal", :package, match(include("btrfsprogs", "snapper")))

      storage.add_packages
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
        expect(http_client).to receive(:set_resolvables)
          .with("storage_proposal", :package, match(include("open-iscsi", "iscsiuio")))

        storage.add_packages
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
      expect(copy_files).to receive(:run)
      expect(bootloader_finish).to receive(:write)
      expect(Yast::WFM).to receive(:CallFunction).with("storage_finish", ["Write"])
      expect(Yast::WFM).to receive(:CallFunction).with("iscsi-client_finish", ["Write"])
      expect(Yast2::FsSnapshot).to receive(:configure_snapper)
      expect(Yast::WFM).to receive(:CallFunction).with("umount_finish", ["Write"])
      expect(Yast::Execute).to receive(:locally).with(
        "agama", "logs", "store", "--destination", /\/var\/log\/agama-installation\/logs/
      )
      storage.finish
    end
  end

  describe "#actions" do
    it "return an empty list if the system has not been probed yet" do
      expect(subject.actions).to eq([])
    end

    context "if the system was probed" do
      before do
        mock_storage(devicegraph: "partitioned_md.yml")

        subject.proposal.calculate_from_json(config_json)
      end

      let(:config_json) do
        {
          storage: {
            drives: [
              {
                search:     "/dev/sdb",
                partitions: [
                  { search: "*", delete: true },
                  { filesystem: { path: "/" } }
                ]
              }
            ]
          }
        }
      end

      it "returns the list of actions" do
        expect(subject.actions).to include(
          an_object_having_attributes(text: /Create partition \/dev\/sdb1/)
        )
      end
    end
  end
end
