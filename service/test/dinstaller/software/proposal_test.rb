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

require_relative "../../test_helper"
require "dinstaller/software/proposal"
require "dinstaller/config"

describe DInstaller::Software::Proposal do
  subject(:proposal) { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout) }

  describe "#add_repository" do
    it "registers the repository in the packaging system" do
      url = "https://example.net"
      expect(Yast::Pkg).to receive(:SourceCreate).with(url, "/").and_return(0)
      expect(proposal.add_repository(url)).to eq(true)
    end

    context "when it is not possible to register the repository" do
      before do
        allow(Yast::Pkg).to receive(:SourceCreate).and_return(1)
      end

      it "returns false" do
        expect(proposal.add_repository("https://example.net/")).to eq(false)
      end
    end
  end

  describe "#calculate" do
    let(:destdir) { "/mnt" }
    let(:result) { {} }
    let(:last_error) { "" }
    let(:solve_errors) { 0 }

    before do
      allow(Yast::Pkg).to receive(:SourceSaveAll)
      allow(Yast::Packages).to receive(:Proposal).and_return(result)
      allow(Yast::Pkg).to receive(:TargetFinish)
      allow(Yast::Pkg).to receive(:TargetInitialize)
      allow(Yast::Pkg).to receive(:TargetLoad)
      allow(Yast::Installation).to receive(:destdir).and_return(destdir)
      allow(Yast::Pkg).to receive(:LastError).and_return(last_error)
      allow(Yast::Pkg).to receive(:PkgSolveErrors).and_return(solve_errors)
      allow(Yast::Pkg).to receive(:SetSolverFlags)
    end

    it "initializes the packaging target" do
      expect(Yast::Pkg).to receive(:TargetFinish)
      expect(Yast::Pkg).to receive(:TargetInitialize).with(destdir)
      expect(Yast::Pkg).to receive(:TargetLoad)
      subject.calculate
    end

    it "makes a proposal" do
      expect(Yast::Packages).to receive(:Proposal).and_return(result)
      expect(Yast::Pkg).to receive(:PkgSolve)
      subject.calculate
    end

    it "selects the language packages" do
      expect(Yast::Pkg).to receive(:SetAdditionalLocales).with(["de_DE"])
      subject.languages = ["de_DE"]
      subject.calculate
    end

    it "returns true" do
      expect(subject.calculate).to eq(true)
    end

    context "when a proposal is not possible or contain errors" do
      let(:solve_errors) { 1 }

      it "returns false" do
        expect(subject.calculate).to eq(false)
      end
    end

    context "when no errors were reported" do
      it "does not register any error" do
        subject.calculate
        expect(subject.errors).to be_empty
      end
    end

    context "when a blocking warning is reported" do
      let(:result) do
        { "warning_level" => :blocker, "warning" => "Could not install..." }
      end

      it "registers the corresponding validation error" do
        subject.calculate
        expect(subject.errors).to eq(
          [DInstaller::ValidationError.new("Could not install...")]
        )
      end
    end

    context "when solver errors are reported" do
      let(:last_error) { "Solving errors..." }
      let(:solve_errors) { 5 }

      it "returns something" do
        subject.calculate
        expect(subject.errors).to eq(
          [
            DInstaller::ValidationError.new("Solving errors..."),
            DInstaller::ValidationError.new("Found 5 dependency issues.")
          ]
        )
      end
    end
  end

  describe "#validate" do
    context "when no proposal was calculated" do
      it "returns an empty array" do
        expect(subject.errors).to eq([])
      end
    end

    context "when a blocking was reported" do
      it "returns a validation error for the package/pattern"
    end
  end

  describe "#set_resolvables" do
    it "adds the list of packages/patterns to the proposal"
  end
end
