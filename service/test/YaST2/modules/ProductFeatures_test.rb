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


Yast.import "ProductFeatures"

describe Yast::ProductFeatures do
  subject { Yast::ProductFeatures }

  before do
    allow(Yast::SCR).to receive(:Dir).and_return([])
  end

  context "With simple features" do

    let(:simple_features) do
      {
        "globals" => {
          "enable_true"  => true,
          "enable_false" => false,
          "enable_yes"   => "yes",
          "enable_no"    => "no",
          "enable_xy"    => "xy",
          "enable_empty" => ""
          # "enable_missing" => nil
        }
      }
    end

    before do
      subject.Import(simple_features)
    end

    describe ".GetBooleanFeature" do
      it "gets simple boolean values" do
        expect(subject.GetBooleanFeature("globals", "enable_true")).to be true
        expect(subject.GetBooleanFeature("globals", "enable_false")).to be false
      end

      it "understands 'yes'" do
        expect(subject.GetBooleanFeature("globals", "enable_yes")).to be true
      end

      it "falls back to 'false' for arbitrary texts" do
        expect(subject.GetBooleanFeature("globals", "enable_xy")).to be false
      end

      it "falls back to 'false' for empty strings" do
        expect(subject.GetBooleanFeature("globals", "enable_empty")).to be false
      end

      it "falls back to 'false' for missing values" do
        expect(subject.GetBooleanFeature("globals", "enable_missing")).to be false
      end
    end

    describe ".GetBooleanFeatureWithFallback" do
      it "gets simple boolean values" do
        expect(subject.GetBooleanFeatureWithFallback("globals", "enable_true",  false)).to be true
        expect(subject.GetBooleanFeatureWithFallback("globals", "enable_false", true)).to be false
      end

      it "understands 'yes' and 'no'" do
        expect(subject.GetBooleanFeatureWithFallback("globals", "enable_yes", false)).to be true
        expect(subject.GetBooleanFeatureWithFallback("globals", "enable_no",  true)).to be false
      end

      it "uses the fallback for arbitrary texts" do
        expect(subject.GetBooleanFeatureWithFallback("globals", "enable_xy", true)).to be true
      end

      it "uses the fallback for empty strings" do
        expect(subject.GetBooleanFeatureWithFallback("globals", "enable_empty", true)).to be true
      end

      it "uses the fallback for missing values" do
        expect(subject.GetBooleanFeatureWithFallback("globals", "enable_missing", true)).to be true
        expect(subject.GetBooleanFeatureWithFallback("globals", "enable_missing", false)).to be false
      end
    end
  end

  context "With overlays" do
    before do
      # ensure no overlay is active
      subject.ClearOverlay
    end

    let(:original_features) do
      {
        "globals"      => {
          "keyboard  " => "Hammond",
          "flags"      => ["Uruguay", "Bhutan"]
        },
        "partitioning" => {
          "open_space" => false
        }
      }
    end

    let(:overlay_features) do
      {
        "globals"  => {
          "flags" => ["Namibia"]
        },
        "software" => {
          "packages" => ["tangut-fonts"]
        }
      }
    end

    let(:resulting_features) do
      {
        "globals"      => {
          "keyboard  " => "Hammond",
          "flags"      => ["Namibia"]
        },
        "partitioning" => {
          "open_space" => false
        },
        "software"     => {
          "packages" => ["tangut-fonts"]
        }
      }
    end

    describe ".SetOverlay" do
      it "overrides desired values and keeps other values" do
        subject.Import(original_features)
        subject.SetOverlay(overlay_features)
        expect(subject.Export).to eq(resulting_features)
      end

      it "raises RuntimeError if called twice without ClearOverlay meanwhile" do
        subject.Import(original_features)
        subject.SetOverlay(overlay_features)
        expect { subject.SetOverlay(overlay_features) }.to raise_error(RuntimeError)
      end
    end

    describe ".ClearOverlay" do
      it "restores the original state" do
        subject.Import(original_features)
        subject.SetOverlay(overlay_features)
        subject.ClearOverlay
        expect(subject.Export).to eq(original_features)
      end

      it "does nothing in second consequent call" do
        subject.Import(original_features)
        subject.SetOverlay(overlay_features)
        subject.ClearOverlay
        subject.SetFeature("globals", "keyboard", "test")
        subject.ClearOverlay
        expect(subject.Export).to_not eq(original_features)
      end

      it "keeps the original state if nothing was overlaid" do
        subject.Import(original_features)
        subject.ClearOverlay
        expect(subject.Export).to eq(original_features)
      end
    end
  end

  describe "#GetFeature" do
    let(:scr_root_dir) { File.join(FIXTURES_PATH, "yast2", "control") }
    let(:normal_stage) { false }
    let(:firstboot_stage) { false }

    before do
      allow(Yast::Stage).to receive(:normal).and_return(normal_stage)
      allow(Yast::Stage).to receive(:firstboot).and_return(firstboot_stage)
      allow(Yast::SCR).to receive(:Dir).and_call_original
    end

    around do |example|
      change_scr_root(scr_root_dir, &example)
    end

    it "initializes feature if needed" do
      expect(subject).to receive(:InitIfNeeded)

      subject.GetFeature("globals", "base_product_license_directory")
    end

    context "in normal stage" do
      let(:normal_stage) { true }

      it "reads the value from the running system" do
        # value read from data/etc/YaST2/ProductFeatures file
        expect(subject.GetFeature("globals", "base_product_license_directory"))
          .to eq("/path/to/licenses/product/base")
      end
    end

    context "in firstboot stage" do
      let(:firstboot_stage) { true }

      it "reads the value from the running system" do
        # value read from data/etc/YaST2/ProductFeatures file
        expect(subject.GetFeature("globals", "base_product_license_directory"))
          .to eq("/path/to/licenses/product/base")
      end
    end
  end

  describe "#InitIfNeeded" do
    let(:normal_stage) { false }
    let(:firstboot_stage) { false }

    before do
      allow(Yast::Stage).to receive(:normal).and_return(normal_stage)
      allow(Yast::Stage).to receive(:firstboot).and_return(firstboot_stage)
    end

    it "ensures that features are initialized" do
      expect(subject).to receive(:InitFeatures).with(false)

      subject.InitIfNeeded
    end

    context "in normal stage" do
      let(:normal_stage) { true }

      it "restores the available values in the running system" do
        expect(subject).to receive(:Restore)

        subject.InitIfNeeded
      end
    end

    context "in firstboot stage" do
      let(:firstboot_stage) { true }

      it "does not restore the available values in the running system" do
        expect(subject).to_not receive(:Restore)

        subject.InitIfNeeded
      end
    end
  end
end
