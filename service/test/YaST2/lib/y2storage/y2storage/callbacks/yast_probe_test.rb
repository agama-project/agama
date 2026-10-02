#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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
require "y2storage/callbacks/yast_probe"

describe Y2Storage::Callbacks::YastProbe do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new }

  let(:devicegraph) { devicegraph_from(scenario) }

  let(:scenario) { "mixed_disks" }

  describe "#report_issues" do
    let(:issues) { Y2Issues::List.new([Y2Storage::Issue.new("Issue 1")]) }
    let(:reporter) { Y2Storage::IssuesReporter.new(issues) }
    let(:acepted) { true }

    before do
      allow(Y2Storage::IssuesReporter).to receive(:new).with(issues)
        .and_return(reporter)

      allow(reporter).to receive(:report).and_return(acepted)
    end

    it "reports the issues" do
      expect(reporter).to receive(:report) do |args|
        expect(args[:message]).to include("Issues found")
      end

      subject.report_issues(issues)
    end

    context "when the report is accepted" do
      let(:accepted) { true }

      it "returns true" do
        expect(subject.report_issues(issues)).to eq(true)
      end
    end

    context "when the report is rejected" do
      let(:acepted) { false }

      it "returns false" do
        expect(subject.report_issues(issues)).to eq(false)
      end
    end

    context "when there are no probing issues" do
      let(:issues) { Y2Issues::List.new }

      it "does not report issues" do
        expect_any_instance_of(Y2Storage::IssuesReporter).to_not receive(:report)

        subject.report_issues(issues)
      end

      it "returns true" do
        expect(subject.report_issues(issues)).to eq(true)
      end
    end
  end

  describe "#install_packages?" do
    before do
      allow(Yast2::Popup).to receive(:show).and_return(answer)
    end

    let(:answer) { :install }

    it "asks the user whether packages should be installed" do
      expect(Yast2::Popup).to receive(:show)
        .with(/The following package needs to be installed/, buttons: Hash, focus: :install)
        .and_return(:install)
      subject.install_packages?(["btrfsprogs"])
    end

    context "if the clicks 'Ignore'" do
      let(:answer) { :ignore }

      it "returns false" do
        expect(subject.install_packages?(["btrfsprogs"])).to eq(false)
      end
    end

    context "if the clicks 'Ignore'" do
      it "returns true" do
        expect(subject.install_packages?(["btrfsprogs"])).to eq(true)
      end
    end
  end
end
