#!/usr/bin/env rspec
# Copyright (c) [2020] SUSE LLC
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
require "installation/autoinst_issues/issue"

describe Installation::AutoinstIssues::Issue do
  subject(:issue) { described_class.new }

  describe "#message" do
    it "raises a NotImplementedError exception" do
      expect { issue.message }.to raise_error(NotImplementedError)
    end
  end

  describe "#severity" do
    it "raises a NotImplementedError exception" do
      expect { issue.severity }.to raise_error(NotImplementedError)
    end
  end

  describe "#warn?" do
    before do
      allow(issue).to receive(:severity).and_return(severity)
    end

    context "when severity is :warn" do
      let(:severity) { :warn }

      it "returns true" do
        expect(issue).to be_warn
      end
    end

    context "when severity is not :warn" do
      let(:severity) { :fatal }

      it "returns false" do
        expect(issue).to_not be_warn
      end
    end
  end

  describe "#fatal?" do
    before do
      allow(issue).to receive(:severity).and_return(severity)
    end

    context "when severity is :fatal" do
      let(:severity) { :fatal }

      it "returns true" do
        expect(issue).to be_fatal
      end
    end

    context "when severity is not :fatal" do
      let(:severity) { :warn }

      it "returns false" do
        expect(issue).to_not be_fatal
      end
    end
  end
end
