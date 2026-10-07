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
require "installation/autoinst_issues/list"

module Test
  module AutoinstIssues
    # Represents a problem that occurs when an exception is raised.
    class Exception < ::Installation::AutoinstIssues::Issue
      # @return [StandardError]
      attr_reader :error

      # @param error [StandardError]
      def initialize(error)
        super()

        @error = error
      end

      # Return problem severity
      #
      # @return [Symbol] :fatal
      # @see Issue#severity
      def severity
        :fatal
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        format(
          "A problem ocurred: %s",
          error.message
        )
      end
    end
  end
end

describe Installation::AutoinstIssues::List do
  subject(:list) { described_class.new }

  let(:issue) { instance_double(Test::AutoinstIssues::Exception) }

  describe "#add" do
    it "adds a new issue to the list" do
      list.add(Test::AutoinstIssues::Exception, StandardError.new)
      expect(list.to_a).to all(be_an(Test::AutoinstIssues::Exception))
    end
  end

  describe "#to_a" do
    context "when list is empty" do
      it "returns an empty array" do
        expect(list.to_a).to eq([])
      end
    end

    context "when some issue was added" do
      before do
        2.times { list.add(Test::AutoinstIssues::Exception, StandardError.new) }
      end

      it "returns an array containing added issues" do
        expect(list.to_a).to all(be_a(Test::AutoinstIssues::Exception))
        expect(list.to_a.size).to eq(2)
      end
    end
  end

  describe "#empty?" do
    context "when list is empty" do
      it "returns true" do
        expect(list).to be_empty
      end
    end

    context "when some issue was added" do
      before { list.add(Test::AutoinstIssues::Exception, StandardError.new) }

      it "returns false" do
        expect(list).to_not be_empty
      end
    end
  end

  describe "#fatal?" do
    context "when contains some fatal error" do
      before { list.add(Test::AutoinstIssues::Exception, StandardError.new) }

      it "returns true" do
        expect(list).to be_fatal
      end
    end
  end
end
