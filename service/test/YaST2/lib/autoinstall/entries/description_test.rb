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

require_relative "../../../../test_helper"
require "autoinstall/entries/description"

describe Y2Autoinstallation::Entries::Description do
  # Testing only non trivial behavior
  subject { described_class.new(values, module_name) }

  let(:module_name) { "moduleA" }

  describe "#resource_name" do
    context "X-SuSE-YaST-AutoInstResource defined" do
      let(:values) { { "X-SuSE-YaST-AutoInstResource" => "CoolModule" } }

      it "returns X-SuSE-YaST-AutoInstResource value" do
        expect(subject.resource_name).to eq "CoolModule"
      end
    end

    context "X-SuSE-YaST-AutoInstResource is not defined" do
      let(:values) { {} }

      it "returns #module_name value" do
        expect(subject.resource_name).to eq "moduleA"
      end
    end
  end

  describe "#aliases" do
    context "X-SuSE-YaST-AutoInstResourceAliases defined" do
      let(:values) { { "X-SuSE-YaST-AutoInstResourceAliases" => "ModuleB, ModuleC" } }

      it "returns array with all aliases" do
        expect(subject.aliases).to match_array(["ModuleB", "ModuleC"])
      end
    end

    context "X-SuSE-YaST-AutoInstResourceAliases is not defined" do
      let(:values) { {} }

      it "returns empty array" do
        expect(subject.aliases).to eq([])
      end
    end
  end

  describe "#managed_keys" do
    context "X-SuSE-YaST-AutoInstMerge defined" do
      let(:values) { { "X-SuSE-YaST-AutoInstMerge" => "ModuleB, ModuleC" } }

      it "returns array with all managed keys" do
        expect(subject.managed_keys).to match_array(["ModuleB", "ModuleC"])
      end
    end

    context "X-SuSE-YaST-AutoInstMerge is not defined" do
      let(:values) { {} }

      it "returns array with #resource_name" do
        expect(subject.managed_keys).to eq(["moduleA"])
      end
    end
  end

  describe "#clonable?" do
    let(:values) { { "X-SuSE-YaST-AutoInstClonable" => "true" } }

    it "returns true if X-SuSE-YaST-AutoInstClonable" do
      expect(subject.clonable?).to eq true
    end

    it "returns true for always clonable modules" do
      expect(described_class.new({}, "bootloader").clonable?).to eq true
    end
  end

  describe "#client_name" do
    context "X-SuSE-YaST-AutoInstClient defined" do
      let(:values) { { "X-SuSE-YaST-AutoInstClient" => "test_auto" } }

      it "returns X-SuSE-YaST-AutoInstClient value" do
        expect(subject.client_name).to eq "test_auto"
      end
    end

    context "X-SuSE-YaST-AutoInstClient is not defined" do
      let(:values) { { "X-SuSE-YaST-AutoInstResource" => "fancy" } }

      it "returns #module_name with _auto suffix" do
        expect(subject.client_name).to eq "moduleA_auto"
      end
    end
  end

  describe "#required_modules" do
    context "X-SuSE-YaST-AutoInstRequires defined" do
      let(:values) { { "X-SuSE-YaST-AutoInstRequires" => "ModuleB, ModuleC" } }

      it "returns array with all required modules" do
        expect(subject.required_modules).to match_array(["ModuleB", "ModuleC"])
      end
    end

    context "X-SuSE-YaST-AutoInstRequires is not defined" do
      let(:values) { {} }

      it "returns empty array" do
        expect(subject.required_modules).to eq([])
      end
    end
  end

  describe "#translated_name" do
    let(:values) { { "Name" => "Module A", "X-SuSE-DocTeamID" => "ycc_org.opensuse.yast.AddOn" } }

    it "returns translated text from desktop_translations" do
      to_translate = "Name(org.opensuse.yast.AddOn.desktop): Module A"
      expect(Yast::Builtins).to receive(:dpgettext).with(
        "desktop_translations", "/usr/share/locale", to_translate
      ).and_return("Translated A")

      expect(subject.translated_name).to eq "Translated A"
    end

    it "returns #name if translation is not available" do
      allow(Yast::Builtins).to receive(:dpgettext) { |_, _, text| text }

      expect(subject.translated_name).to eq "Module A"
    end
  end
end
