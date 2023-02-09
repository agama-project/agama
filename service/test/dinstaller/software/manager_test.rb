# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require_relative File.join(
  SRC_PATH, "dinstaller", "dbus", "y2dir", "software", "modules", "PackageCallbacks.rb"
)
require "dinstaller/config"
require "dinstaller/software/manager"
require "dinstaller/dbus/clients/questions"

describe DInstaller::Software::Manager do
  subject { described_class.new(config, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:base_url) { "" }
  let(:destdir) { "/mnt" }
  let(:gpg_keys) { [] }
  let(:repositories) do
    instance_double(
      DInstaller::Software::RepositoriesManager,
      add:    nil,
      load:   nil,
      empty?: true
    )
  end
  let(:proposal) do
    instance_double(
      DInstaller::Software::Proposal,
      :base_product= => nil,
      calculate:        nil,
      :languages= =>    nil,
      set_resolvables:  nil,
      packages_count:   "500 MB"
    )
  end

  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "d-installer.yaml")
  end

  let(:config) do
    DInstaller::Config.new(YAML.safe_load(File.read(config_path)))
  end

  let(:questions_client) do
    instance_double(DInstaller::DBus::Clients::Questions)
  end

  before do
    allow(Yast::Pkg).to receive(:TargetInitialize)
    allow(Yast::Pkg).to receive(:ImportGPGKey)
    allow(Dir).to receive(:glob).with(/keys/).and_return(gpg_keys)
    allow(Yast::Packages).to receive(:Proposal).and_return({})
    allow(Yast::InstURL).to receive(:installInf2Url).with("")
      .and_return(base_url)
    allow(Yast::Pkg).to receive(:SourceCreate)
    allow(Yast::Installation).to receive(:destdir).and_return(destdir)
    allow(DInstaller::DBus::Clients::Questions).to receive(:new).and_return(questions_client)
    allow(DInstaller::Software::RepositoriesManager).to receive(:new).and_return(repositories)
    allow(DInstaller::Software::Proposal).to receive(:new).and_return(proposal)
  end

  describe "#probe" do
    let(:rootdir) { Dir.mktmpdir }
    let(:repos_dir) { File.join(rootdir, "etc", "zypp", "repos.d") }
    let(:backup_repos_dir) { File.join(rootdir, "etc", "zypp", "repos.d.backup") }

    before do
      stub_const("DInstaller::Software::Manager::REPOS_DIR", repos_dir)
      stub_const("DInstaller::Software::Manager::REPOS_BACKUP", backup_repos_dir)
      FileUtils.mkdir_p(repos_dir)
    end

    after do
      FileUtils.remove_entry(rootdir)
    end

    it "initializes the package system" do
      expect(Yast::Pkg).to receive(:TargetInitialize).with("/")
      subject.probe
    end

    context "when GPG keys are available at /" do
      let(:gpg_keys) { ["/usr/lib/gnupg/keys/gpg-key.asc"] }

      it "imports the GPG keys" do
        expect(Yast::Pkg).to receive(:ImportGPGKey).with(gpg_keys.first, true)
        subject.probe
      end
    end

    it "creates a packages proposal" do
      expect(proposal).to receive(:calculate)
      subject.probe
    end

    it "registers the repository from config" do
      expect(repositories).to receive(:add).with(/tumbleweed/)
      expect(repositories).to receive(:load)
      subject.probe
    end
  end

  describe "#products" do
    it "returns the list of known products" do
      products = subject.products
      expect(products.size).to eq(3)
      id, data = products.first
      expect(id).to eq("Tumbleweed")
      expect(data).to include(
        "name"        => "openSUSE Tumbleweed",
        "description" => String
      )
    end
  end

  describe "#propose" do
    before do
      subject.select_product("Tumbleweed")
    end

    it "creates a new proposal for the selected product" do
      expect(proposal).to receive(:languages=).with(["en_US"])
      expect(proposal).to receive(:base_product=).with("Tumbleweed")
      expect(proposal).to receive(:calculate)
      subject.propose
    end

    it "adds the patterns and packages to install" do
      expect(proposal).to receive(:set_resolvables)
        .with("d-installer", :pattern, ["enhanced_base"])
      expect(proposal).to receive(:set_resolvables)
        .with("d-installer", :pattern, ["optional_base"], optional: true)
      expect(proposal).to receive(:set_resolvables)
        .with("d-installer", :package, ["mandatory_pkg"])
      expect(proposal).to receive(:set_resolvables)
        .with("d-installer", :package, ["optional_pkg"], optional: true)
      subject.propose
    end
  end

  describe "#install" do
    let(:commit_result) { [250, [], [], [], []] }

    before do
      allow(Yast::Pkg).to receive(:Commit).and_return(commit_result)
    end

    it "installs the packages" do
      expect(Yast::Pkg).to receive(:Commit).with({})
        .and_return(commit_result)
      subject.install
    end

    it "sets up the package callbacks" do
      expect(DInstaller::Software::Callbacks::Progress).to receive(:setup)
      subject.install
    end

    context "when packages installation fails" do
      let(:commit_result) { nil }

      it "raises an exception" do
        expect { subject.install }.to raise_error(RuntimeError)
      end
    end
  end

  describe "#validate" do
    before do
      allow(repositories).to receive(:enabled).and_return(enabled_repos)
      allow(repositories).to receive(:disabled).and_return(disabled_repos)
      allow(proposal).to receive(:errors).and_return([proposal_error])
    end

    let(:enabled_repos) { [] }
    let(:disabled_repos) { [] }
    let(:proposal_error) { DInstaller::ValidationError.new("proposal error") }

    context "when there are not enabled repositories" do
      it "does not return the proposal errors" do
        expect(subject.validate).to_not include(proposal_error)
      end
    end

    context "when there are disabled repositories" do
      let(:disabled_repos) do
        [instance_double(DInstaller::Software::Repository, name: "Repo #1")]
      end

      it "returns an error for each disabled repository" do
        expect(subject.validate.size).to eq(1)
        error = subject.validate.first
        expect(error.message).to match(/Could not read the repository/)
      end
    end

    context "when there are enabled repositories" do
      let(:enabled_repos) { [instance_double(DInstaller::Software::Repository)] }
      it "returns the proposal errors" do
        expect(subject.validate).to include(proposal_error)
      end
    end
  end

  describe "#finish" do
    let(:rootdir) { Dir.mktmpdir }
    let(:repos_dir) { File.join(rootdir, "etc", "zypp", "repos.d") }
    let(:backup_repos_dir) { File.join(rootdir, "etc", "zypp", "repos.d.backup") }

    before do
      stub_const("DInstaller::Software::Manager::REPOS_DIR", repos_dir)
      stub_const("DInstaller::Software::Manager::REPOS_BACKUP", backup_repos_dir)
      FileUtils.mkdir_p(repos_dir)
      FileUtils.mkdir_p(backup_repos_dir)
      FileUtils.touch(File.join(backup_repos_dir, "example.repo"))
      puts Dir[File.join(repos_dir, "**", "*")]
    end

    after do
      FileUtils.remove_entry(rootdir)
    end

    it "releases the packaging system and restores the backup" do
      expect(Yast::Pkg).to receive(:SourceSaveAll)
      expect(Yast::Pkg).to receive(:TargetFinish)
      expect(Yast::Pkg).to receive(:SourceCacheCopyTo)
        .with(Yast::Installation.destdir)

      subject.finish
      expect(File).to exist(File.join(repos_dir, "example.repo"))
    end
  end

  describe "#package_installed?" do
    before do
      allow(Yast::Package).to receive(:Installed).with(package, target: :system)
        .and_return(installed?)
    end

    let(:package) { "NetworkManager" }

    context "when the package is installed" do
      let(:installed?) { true }

      it "returns true" do
        expect(subject.package_installed?(package)).to eq(true)
      end
    end

    context "when the package is not installed" do
      let(:installed?) { false }

      it "returns false" do
        expect(subject.package_installed?(package)).to eq(false)
      end
    end
  end
end
