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
require "y2storage/dialogs/issues"

describe Y2Storage::Dialogs::Issues do
  include_context "yast2-storage-ng test setup"

  subject { described_class }

  before do
    allow(Yast::UI).to receive(:OpenDialog).and_return(true)
    allow(Yast::UI).to receive(:SetFocus)
    allow(Yast::UI).to receive(:CloseDialog)
    allow(Yast::UI).to receive(:UserInput).and_return(:cancel)
  end

  let(:issues) { Y2Issues::List.new }

  describe ".show" do
    it "shows the given message" do
      expect(Yast::UI).to receive(:OpenDialog) do |_opts, content|
        message = content.nested_find do |w|
          w.is_a?(Yast::Term) &&
            w.value == :Label &&
            w.params.last.match?(/issues message/)
        end

        expect(message).to_not be_nil
      end

      subject.show("issues message", issues: issues)
    end

    context "when there are issues" do
      let(:issues) { Y2Issues::List.new([Y2Storage::Issue.new("Issue 1")]) }

      it "includes the Details button" do
        expect(Yast::UI).to receive(:OpenDialog) do |_opts, content|

          details = content.nested_find do |w|
            w.is_a?(Yast::Term) &&
              w.value == :PushButton &&
              w.params.last.match?(/Details/)
          end

          expect(details).to_not be_nil
        end

        subject.show("issues message", issues: issues)
      end
    end

    context "when there are no issues" do
      let(:issues) { Y2Issues::List.new }

      it "does not include the Details button" do
        expect(Yast::UI).to receive(:OpenDialog) do |_opts, content|

          details = content.nested_find do |w|
            w.is_a?(Yast::Term) &&
              w.value == :PushButton &&
              w.params.last.match?(/Details/)
          end

          expect(details).to be_nil
        end

        subject.show("issues message", issues: issues)
      end
    end
  end

  describe ".handle_event" do
    let(:params) { [event, nil, nil, nil] }

    before do
      allow(Y2Storage::Dialogs::IssuesDetails).to receive(:new).and_return(issues_details)
    end

    let(:issues_details) { instance_double(Y2Storage::Dialogs::IssuesDetails) }

    context "when the Details button is pushed" do
      let(:event) { :__details }

      it "shows a dialog with the details of the issues" do
        expect(issues_details).to receive(:show)

        subject.handle_event(*params)
      end
    end

    context "when the Details button is not pushed" do
      let(:event) { :other }

      it "does not show a dialog with the details of the issues" do
        expect(issues_details).to_not receive(:show)

        subject.handle_event(*params)
      end
    end
  end
end
