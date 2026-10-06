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

require_relative "#{TEST_PATH}/support/widgets_context"

require "y2storage/widgets/issues"

describe Y2Storage::Widgets::Issues do
  include_context "yast2-storage-ng test setup"

  include_context "widgets"

  subject { described_class.new(id: id, issues: issues) }

  let(:id) { :storage_issues_widget }

  let(:issues) do
    Y2Issues::List.new(
      [
        Y2Storage::Issue.new("Issue 1", details: "Details of issue 1"),
        Y2Storage::Issue.new("Issue 2",
          description: "Description of issue 2", details: "Details of issue 2")
      ]
    )
  end

  let(:issues_widget) do
    subject.content.nested_find { |i| i.is_a?(Yast::Term) && i.value == :SelectionBox }
  end

  let(:issues_items) do
    issues_widget.params.find { |item| item.is_a?(Array) }
  end

  let(:details) do
    subject.content.nested_find { |i| i.is_a?(Yast::Term) && i.value == :RichText }
  end

  def find_item(text)
    issues_items.find { |i| i.params.include?(text) }
  end

  describe "#content" do
    it "contains a list of issues" do
      expect(issues_widget).to_not be_nil
    end

    it "displays the given issues" do
      expect(find_item("Issue 1")).to_not be_nil
      expect(find_item("Issue 2")).to_not be_nil
    end

    it "contains a richtext for displaying the information of the selected issue" do
      expect(details).to_not be_nil
    end
  end

  describe "#handle_event" do
    before do
      # Let's mock the second issue as the selected row
      row_id = find_item("Issue 2").params.first.params[0]
      allow(Yast::UI).to receive(:QueryWidget).with(Id(id), :CurrentItem).and_return(row_id)
    end

    it "displays the information of the selected issue in the richtext box" do
      expect(Yast::UI).to receive(:ChangeWidget)
        .with(Id("#{id}-information"), :Value, /Description.*Technical details.*Details of issue 2/)

      subject.handle_event
    end
  end
end
