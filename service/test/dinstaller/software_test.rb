# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require_relative "../test_helper"
require "dinstaller/software"
require "dinstaller/progress"

describe DInstaller::Software do
  subject { described_class.new(logger) }

  let(:logger) { Logger.new($stdout) }
  let(:progress) { DInstaller::Progress.new }
  let(:products) { [tw_prod] }
  let(:tw_prod) { instance_double(Y2Packager::Product, name: "openSUSE") }
  let(:other_prod) { instance_double(Y2Packager::Product, name: "another") }
  let(:base_url) { "" }
  let(:destdir) { "/mnt" }
  let(:gpg_path) { instance_double(Pathname, glob: []) }

  before do
    allow(Yast::Pkg).to receive(:TargetInitialize)
    allow(Yast::Pkg).to receive(:ImportGPGKey)
    allow(Pathname).to receive(:new).with("/").and_return(gpg_path)
    allow(Y2Packager::Product).to receive(:available_base_products)
      .and_return(products)
    allow(Yast::Packages).to receive(:Proposal).and_return({})
    allow(Yast::InstURL).to receive(:installInf2Url).with("")
      .and_return(base_url)
    allow(Yast::Pkg).to receive(:SourceCreateBase)
    allow(Yast::Installation).to receive(:destdir).and_return(destdir)
  end

  describe "#probe" do
    it "initializes the package system" do
      expect(Yast::Pkg).to receive(:TargetInitialize).with("/")
      subject.probe(progress)
    end

    context "when GPG keys are available at /" do
      before do
        allow(gpg_path).to receive(:glob).with("*.gpg").and_return(["/installkey.gpg"])
      end

      it "imports the GPG keys" do
        expect(Yast::Pkg).to receive(:ImportGPGKey).with("/installkey.gpg", true)
        subject.probe(progress)
      end
    end

    it "creates a packages proposal" do
      expect(Yast::Packages).to receive(:Proposal)
      subject.probe(progress)
    end

    context "when a base URL is defined via the InstURL module" do
      let(:base_url) { "dvd://" }

      it "register the repository" do
        expect(Yast::Pkg).to receive(:SourceCreateBase).with(base_url, "/")
        expect(Yast::Pkg).to receive(:SourceSaveAll)
        subject.probe(progress)
      end
    end

    context "when no base URL is defined" do
      let(:base_url) { "" }

      it "register the repository" do
        expect(Yast::Pkg).to receive(:SourceCreateBase).with(/download.opensuse.org/, "/")
        expect(Yast::Pkg).to receive(:SourceSaveAll)
        subject.probe(progress)
      end
    end

    context "when no supported products are found" do
      let(:products) { [] }

      it "raises an exception" do
        expect { subject.probe(progress) }.to raise_error(RuntimeError)
      end
    end
  end

  describe "#products" do
    describe "before probing" do
      it "returns an empty array" do
        expect(subject.products).to eq([])
      end
    end

    describe "after probing" do
      before { subject.probe(progress) }

      it "returns the name of the found products that are supported" do
        expect(subject.products).to eq([tw_prod])
      end
    end
  end
end
