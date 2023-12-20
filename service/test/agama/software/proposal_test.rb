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
require "agama/software/proposal"
require "agama/config"

describe Agama::Software::Proposal do
  subject(:proposal) { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
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

  describe "#calculate" do
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
      expect(Yast::Pkg).to receive(:SetPackageLocale).with("cs_CZ")
      expect(Yast::Pkg).to receive(:SetAdditionalLocales).with(["de_DE"])
      subject.languages = ["cs_CZ", "de_DE"]
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
      it "does not register any issue" do
        subject.calculate
        expect(subject.issues).to be_empty
      end
    end

    context "when a blocking warning is reported" do
      let(:result) do
        { "warning_level" => :blocker, "warning" => "Could not install..." }
      end

      it "registers the corresponding issue" do
        subject.calculate
        expect(subject.issues).to contain_exactly(
          an_object_having_attributes({ description: "Could not install..." })
        )
      end
    end

    context "when solver errors are reported" do
      let(:last_error) { "Solving errors..." }
      let(:solve_errors) { 5 }

      it "registers them as issues" do
        subject.calculate
        expect(subject.issues).to contain_exactly(
          an_object_having_attributes(description: "Solving errors..."),
          an_object_having_attributes(description: "Found 5 dependency issues.")
        )
      end
    end
  end

  describe "#solve_dependencies" do
    it "calls the solver" do
      expect(Yast::Pkg).to receive(:PkgSolve)
      subject.solve_dependencies
    end

    context "if the solver successes" do
      before do
        allow(Yast::Pkg).to receive(:PkgSolve).and_return(true)
      end

      it "returns true" do
        expect(subject.solve_dependencies).to eq(true)
      end
    end

    context "if the solver fails" do
      before do
        allow(Yast::Pkg).to receive(:PkgSolve).and_return(false)
      end

      let(:solve_errors) { 2 }

      it "returns false" do
        expect(subject.solve_dependencies).to eq(false)
      end

      it "registers solver issue" do
        subject.solve_dependencies
        expect(subject.issues).to contain_exactly(
          an_object_having_attributes(description: "Found 2 dependency issues.")
        )
      end
    end
  end

  describe "#set_resolvables" do
    it "adds the list of packages/patterns to the proposal" do
      expect(Yast::PackagesProposal).to receive(:SetResolvables)
        .with("agama", :pattern, "alp_base", optional: false)
      subject.set_resolvables("agama", :pattern, "alp_base", optional: false)
    end
  end

  describe "#packages_count" do
    before do
      allow(Yast::Pkg).to receive(:PkgMediaCount).and_return([[75], [50], [25], [0]])
    end

    it "returns the amount of packages to install" do
      expect(subject.packages_count).to eq(150)
    end
  end

  describe "#packages_size" do
    before do
      allow(Yast::Pkg).to receive(:PkgMediaSizes)
        .and_return([[900000000], [0], [500000000]])
    end

    it "returns the size of packages to install" do
      expect(subject.packages_size).to eq(1400000000)
    end
  end

  describe "#valid?" do
    context "when the proposal was calculated and there were no errors" do
      it "returns true" do
        subject.calculate
        expect(subject.valid?).to eq(true)
      end
    end

    context "when the proposal is not calculated yet" do
      it "returns false" do
        expect(subject.valid?).to eq(false)
      end
    end

    context "when there are errors" do
      let(:solve_errors) { 1 }

      it "returns false" do
        subject.calculate
        expect(subject.valid?).to eq(false)
      end
    end
  end

  describe "#languages" do
    it "sets the languages to install removing the encoding" do
      subject.languages = ["es_ES.UTF-8", "en_US"]
      expect(subject.languages).to eq(["es_ES", "en_US"])
    end
  end
end
