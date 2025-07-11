# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "yast"
require "agama/autoyast/localization_reader"

Yast.import "Profile"

describe Agama::AutoYaST::LocalizationReader do
  let(:profile) do
    {}
  end

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no localization-related sections" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when a keymap is defined" do
      let(:profile) do
        { "keyboard" => { "keymap" => "us" } }
      end

      it "includes a 'keyboard' key with its value" do
        localization = subject.read["localization"]
        expect(localization["keyboard"]).to eq("us")
      end
    end

    context "when a YaST-specific keymap is defined" do
      let(:profile) do
        { "keyboard" => { "keymap" => "english-uk" } }
      end

      it "includes a 'keyboard' key with the new identifier" do
        localization = subject.read["localization"]
        expect(localization["keyboard"]).to eq("gb")
      end
    end

    context "when there are primary and secondary languages" do
      let(:profile) do
        {
          "language" => {
            "language"  => "en_US.UTF-8",
            "languages" => "es_ES.UTF-8, cs_CZ.UTF-8"
          }
        }
      end

      it "includes a 'language' key with the primary language" do
        localization = subject.read["localization"]
        expect(localization["language"]).to eq("en_US.UTF-8")
      end

      context "when the encoding is not included" do
        let(:profile) do
          {
            "language" => {
              "language"  => "en_US",
              "languages" => "es_ES"
            }
          }
        end

        it "uses the UTF-8 encoding" do
          localization = subject.read["localization"]
          expect(localization["language"]).to eq("en_US.UTF-8")
        end
      end
    end

    context "when a timezone is defined" do
      let(:profile) do
        { "timezone" => { "timezone" => "Europe/Berlin" } }
      end

      it "includes a 'keyboard' key with its value" do
        localization = subject.read["localization"]
        expect(localization["timezone"]).to eq("Europe/Berlin")
      end
    end
  end
end
