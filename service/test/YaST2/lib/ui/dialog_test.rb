# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../../../test_helper"

require "ui/dialog"

class TestDialog < UI::Dialog
  def dialog_content
    HBox(
      PushButton(Id(:ok), "OK"),
      PushButton(Id(:cancel), "Cancel")
    )
  end

  def ok_handler
    finish_dialog(true)
  end
end

class TestDialog2 < TestDialog
  def dialog_options
    Yast::Term.new(:opt, :defaultsize)
  end
end

describe UI::Dialog do
  subject { TestDialog }
  describe ".run" do
    def mock_ui_events(*events)
      allow(Yast::UI).to receive(:UserInput).and_return(*events)
    end

    before do
      Yast.import "UI"
      allow(Yast::UI).to receive(:OpenDialog).and_return(true)
      allow(Yast::UI).to receive(:CloseDialog).and_return(true)
      mock_ui_events(:cancel)
    end

    it "returns value from EventDispatcher last handler" do
      mock_ui_events(:ok)

      expect(subject.run).to eq(true)
    end

    it "opens dialog" do
      expect(Yast::UI).to receive(:OpenDialog).and_return(true)

      subject.run
    end

    it "raise exception if dialog opening failed" do
      allow(Yast::UI).to receive(:OpenDialog).and_return(false)

      expect { subject.run }.to raise_error
    end

    it "ensure dialog is closed even if exception is raised in event loop" do
      mock_ui_events(:invalid_event)
      expect(Yast::UI).to receive(:CloseDialog)

      begin
        subject.run
      rescue StandardError
        "expected"
      end
    end

    it "raise NoMethodError if abstract method dialog_content is not implemented" do
      expect { UI::Dialog.run }.to raise_error(NoMethodError)
    end

    it "pass dialog options if defined" do
      expect(Yast::UI).to receive(:OpenDialog).and_return(true)
        .with(Yast::Term.new(:opt, :defaultsize), anything)

      TestDialog2.run
    end
  end
end
