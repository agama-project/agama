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

Yast.import "ServicesManagerTarget"

describe Yast::ServicesManagerTargetClass::BaseTargets do
  it "loads successfully via Yast.import" do
    expect(Yast::ServicesManagerTarget).to_not be_nil
  end

  describe "::GRAPHICAL" do
    it "is the 'graphical' target name" do
      expect(described_class::GRAPHICAL).to eq("graphical")
    end
  end

  describe "::MULTIUSER" do
    it "is the 'multi-user' target name" do
      expect(described_class::MULTIUSER).to eq("multi-user")
    end
  end

  describe "::TRANSLATIONS" do
    it "maps the known target names to their human-readable descriptions" do
      expect(described_class::TRANSLATIONS).to include(
        "graphical"                 => "Graphical mode",
        "multi-user"                => "Text mode",
        "emergency.target"          => "Emergency Mode",
        "graphical.target"          => "Graphical Interface",
        "initrd.target"             => "Initrd Default Target",
        "initrd-switch-root.target" => "Switch Root",
        "multi-user.target"         => "Multi-User System",
        "rescue.target"             => "Rescue Mode"
      )
    end
  end

  describe ".localize" do
    context "when the target is known" do
      it "returns the localized description" do
        expect(described_class.localize(described_class::GRAPHICAL)).to eq("Graphical mode")
      end
    end

    context "when the target is unknown" do
      it "returns the given target unlocalized" do
        expect(described_class.localize("unknown-target")).to eq("unknown-target")
      end
    end
  end
end
