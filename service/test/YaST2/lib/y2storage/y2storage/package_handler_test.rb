#!/usr/bin/env rspec
#
# frozen_string_literal: true

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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage/package_handler"
require "y2storage/storage_feature"

describe Y2Storage::PackageHandler do
  include_context "yast2-storage-ng test setup"

  let(:feature_pkg) { ["lvm2", "btrfsprogs", "e2fsprogs"] }
  before do
    allow(Yast::Package).to receive(:Installed).and_return(false)
    allow(Yast::Pkg).to receive(:PkgSolve).and_return(true)
    allow(Yast::Mode).to receive(:installation).and_return(installation)
  end
  subject { described_class.new(feature_pkg) }

  describe "#commit" do
    context "during installation" do
      let(:installation) { true }

      it "executes #set_proposal_packages and returns its result" do
        expect(subject).to receive(:set_proposal_packages).and_return "result"
        expect(subject.commit).to eq "result"
      end
    end

    context "in the installed system" do
      let(:installation) { false }

      it "executes #install(ask: false) and returns its result" do
        expect(subject).to receive(:install).with(ask: false).and_return "result"
        expect(subject.commit).to eq "result"
      end
    end
  end

  describe "#set_proposal_packages" do
    let(:installation) { true }

    before do
      allow(Yast::PackagesProposal).to receive(:SetResolvables).and_return true
    end

    it "sets the proposal packages" do
      expect(Yast::PackagesProposal).to receive(:SetResolvables)
      subject.set_proposal_packages
    end

    it "does not try to install the packages" do
      expect(Yast::Package).to_not receive(:DoInstall)
      subject.set_proposal_packages
    end

    it "pops up an error dialog if setting the proposal packages failed" do
      allow(Yast::PackagesProposal).to receive(:SetResolvables).and_return(false)
      expect(Yast::Report).to receive(:Error)
      subject.set_proposal_packages
    end

    it "does not check for already installed packages" do
      expect(Yast::Package).to_not receive(:Installed)
      subject.set_proposal_packages
    end
  end

  describe "#install" do
    before do
      allow(Yast::Package).to receive(:Installed).and_return false
      allow(Yast::Package).to receive(:DoInstall).and_return true
    end
    let(:installation) { false }

    context "with :ask set to false" do
      it "installs packages directly in the installed system" do
        expect(Yast::Package).to receive(:DoInstall).with(subject.pkg_list)
        subject.install(ask: false)
      end

      it "does not install packages that are already installed" do
        # Let's simulate the first package is already installed
        allow(Yast::Package).to receive(:Installed).with(feature_pkg[0]).and_return true

        expect(Yast::Package).to receive(:DoInstall).with(feature_pkg[1..-1])
        subject.install(ask: false)
      end

      it "pops up an error dialog if package installation failed" do
        allow(Yast::Package).to receive(:DoInstall).and_return(false)
        expect(Yast::Report).to receive(:Error)
        subject.install(ask: false)
      end
    end

    context "by default (:ask is true)" do
      before do
        allow(Yast::Package).to receive(:CheckAndInstallPackages).and_return true
      end

      it "installs packages directly in the installed system" do
        expect(Yast::Package).to receive(:CheckAndInstallPackages).with(subject.pkg_list)
        subject.install
      end

      it "does not install packages that are already installed" do
        # Let's simulate the first package is already installed
        allow(Yast::Package).to receive(:Installed).with(feature_pkg[0]).and_return true

        expect(Yast::Package).to receive(:CheckAndInstallPackages).with(feature_pkg[1..-1])
        subject.install
      end

      it "pops up an error dialog if package installation failed" do
        allow(Yast::Package).to receive(:CheckAndInstallPackages).and_return(false)
        expect(Yast::Report).to receive(:Error)
        subject.install
      end
    end
  end

  describe ".set_proposal_packages_for" do
    before do
      fake_scenario(scenario)
      Y2Storage::StorageFeature.drop_cache
      allow(Yast::Mode).to receive(:installation).and_return(installation)
      allow(Yast::Package).to receive(:Installed).and_return(false)
      allow(Yast::Package).to receive(:Available).and_return(true)
    end

    context "with local devices combining several filesystem types" do
      PROPOSAL_ID = "storage_proposal"
      let(:scenario) { "mixed_disks" }
      let(:installation) { true }

      it "Adds the correct required and optional storage packages to the proposal" do
        expect(Yast::PackagesProposal).to receive(:SetResolvables)
          .with(PROPOSAL_ID, :package, ["btrfsprogs", "e2fsprogs", "xfsprogs"], optional: false)
          .and_return true
        expect(Yast::PackagesProposal).to receive(:SetResolvables)
          .with(PROPOSAL_ID, :package, ["e2fsprogs", "ntfs-3g", "ntfsprogs"], optional: true)
          .and_return true
        described_class.set_proposal_packages_for(fake_devicegraph)
      end

      it "Adds only required storage packages to the proposal if 'optional' is 'false" do
        expect(Yast::PackagesProposal).to receive(:SetResolvables)
          .with(PROPOSAL_ID, :package, ["btrfsprogs", "e2fsprogs", "xfsprogs"], optional: false)
          .and_return true
        described_class.set_proposal_packages_for(fake_devicegraph, optional: false)
      end
    end

    context "with empty disks" do
      let(:scenario) { "empty_disks" }
      let(:installation) { true }

      it "Does not add any storage packages to the proposal" do
        expect(Yast::PackagesProposal).not_to receive(:SetResolvables)
        described_class.set_proposal_packages_for(fake_devicegraph, optional: true)
      end
    end
  end
end
