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

require_relative "../../test_helper"

Yast.import "Wizard"

describe Yast::Wizard do
  subject { described_class }

  describe ".CreateDialog" do
    before do
      allow(Yast::UI).to receive(:OpenDialog)
    end

    it "sets product name in UI" do
      expect(Yast::UI).to receive(:SetProductName)

      subject.CreateDialog
    end

    it "opens Dialog" do
      expect(Yast::UI).to receive(:OpenDialog)

      subject.CreateDialog
    end
  end

  describe ".SetHelpText" do
    it "calls UI Wizard command SetHelpText" do
      expect(Yast::UI).to receive(:WizardCommand).with(term(:SetHelpText, "test")).and_return(true)

      subject.SetHelpText("test")
    end

    it "calls ChangeWidget if Wizard Command failed" do
      allow(Yast::UI).to receive(:WizardCommand).and_return(false)
      expect(Yast::UI).to receive(:ChangeWidget).with(anything, :HelpText, "test")

      subject.SetHelpText("test")
    end
  end

  describe ".UserInput" do
    it "returns result of UI UserInput" do
      allow(Yast::UI).to receive(:UserInput).and_return(:ok)

      expect(subject.UserInput).to eq :ok
    end

    it "returns :next if UI UserInput is :accept" do
      allow(Yast::UI).to receive(:UserInput).and_return(:accept)

      expect(subject.UserInput).to eq :next
    end

    it "returns :back if UI UserInput is :cancel" do
      allow(Yast::UI).to receive(:UserInput).and_return(:cancel)

      expect(subject.UserInput).to eq :back
    end
  end

  # ".OpenWithLayout" is not ported: it takes a ::UI::Wizards::Layout, a cwm widget class that is
  # never vendored (confirmed unreachable from Agama's own code - Wizard.rb:612 is its only
  # reference anywhere in the closure).
end
