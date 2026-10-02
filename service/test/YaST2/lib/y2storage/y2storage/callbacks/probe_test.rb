#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2021] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"
require_relative "issues_callback_examples"
require "y2storage/callbacks/probe"

describe Y2Storage::Callbacks::Probe do
  include_context "yast2-storage-ng test setup"

  subject(:callbacks) { described_class.new }

  describe "#issues" do
    include_examples "#issues"
  end

  describe "#error" do
    include_examples "#error"
  end

  describe "#begin" do
    before do
      allow(Yast::Pkg).to receive(:SourceReleaseAll)
    end

    it "clears again flag" do
      subject.begin
      expect(subject.again?).to be false
    end

    context "during installation" do
      before do
        allow(Yast::Mode).to receive(:installation).and_return(true)
      end

      it "releases software source devices before probing" do
        expect(Yast::Pkg).to receive(:SourceReleaseAll)
        subject.begin
      end
    end

    context "in an installed system" do
      before do
        allow(Yast::Mode).to receive(:installation).and_return(false)
      end

      it "releases software source devices before probing" do
        expect(Yast::Pkg).to_not receive(:SourceReleaseAll)
        subject.begin
      end
    end
  end

  describe "#again?" do
    context "when #begin has been called" do
      before { subject.begin }

      it "returns false" do
        expect(subject.again?).to be false
      end
    end
  end

  describe "#missing_command" do
    before do
      allow(Yast::Mode).to receive(:normal).and_return normal_mode
    end

    # unary +"..." to get mutable copies: #missing_command calls #force_encoding on the message
    let(:msg) { +"the message" }
    let(:what) { +"the what" }
    # unary +"..." to get a mutable copy: #missing_command calls #force_encoding on it too
    let(:cmd) { +"the command" }

    RSpec.shared_examples "generic error" do
      it "just generates the issue with error and the details" do
        subject.missing_command(msg, what, cmd, features)

        issue = subject.issues.first

        expect(issue.message).to eq(msg)
        expect(issue.details).to include(what)
      end
    end

    context "during (auto)installation" do
      let(:normal_mode) { false }

      context "if features is 0" do
        let(:features) { 0 }

        include_examples "generic error"
      end

      context "if features is not 0" do
        let(:features) { Storage::UF_BTRFS }

        include_examples "generic error"
      end
    end

    context "during normal execution" do
      let(:normal_mode) { true }

      context "if features is 0" do
        let(:features) { 0 }

        include_examples "generic error"
      end

      context "if features is not 0" do
        let(:features) { Storage::UF_BTRFS }

        it "displays a pop-up with the list of packages to install" do
          expect(Yast2::Popup).to receive(:show) do |message, options|
            expect(message).to include "btrfsprogs, e2fsprogs"
            expect(options[:buttons].keys).to contain_exactly(:ignore, :install)
            :ignore
          end

          subject.missing_command(msg, what, cmd, features)
        end

        context "if the user clicks on :install" do
          before do
            allow(Yast2::Popup).to receive(:show).and_return :install
            allow(Y2Storage::PackageHandler).to receive(:new).and_return pkg_handler
          end

          let(:pkg_handler) { double("PackageHandler", commit: true) }

          it "returns false" do
            expect(subject.missing_command(msg, what, cmd, features)).to eq false
          end

          it "installs the packages" do
            expect(Y2Storage::PackageHandler).to receive(:new).with(["btrfsprogs", "e2fsprogs"])
            expect(pkg_handler).to receive(:commit)

            subject.missing_command(msg, what, cmd, features)
          end

          it "sets #again? to true" do
            subject.begin
            expect(subject.again?).to eq false

            subject.missing_command(msg, what, cmd, features)
            expect(subject.again?).to eq true
          end
        end

        context "if the user clicks on :ignore" do
          before { allow(Yast2::Popup).to receive(:show).and_return :ignore }

          it "returns true" do
            expect(subject.missing_command(msg, what, cmd, features)).to eq true
          end

          it "does not install the packages" do
            expect(Y2Storage::PackageHandler).to_not receive(:new)
            subject.missing_command(msg, what, cmd, features)
          end

          it "does not set #again?" do
            subject.begin
            expect(subject.again?).to eq false

            subject.missing_command(msg, what, cmd, features)
            expect(subject.again?).to eq false
          end
        end
      end
    end
  end
end
