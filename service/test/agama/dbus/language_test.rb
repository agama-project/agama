# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "agama/dbus/language"
require "agama/errors"
require "agama/language"
require "agama/progress"

describe Agama::DBus::Language do
  subject { described_class.new(backend, logger) }

  let(:backend) do
    instance_double(Agama::Language, languages: languages, language: "de_DE")
  end

  let(:logger) { Logger.new($stdout) }

  let(:languages) do
    {
      "en_US" => ["English (US)", "English (US)", ".UTF-8", "", "English (US)"],
      "de_DE" => ["Deutsch", "Deutsch", ".UTF-8", "@euro", "German"]
    }
  end

  describe "#available_languages" do
    it "returns the list of available languages" do
      expect(subject.available_languages).to eq(
        [["en_US", "English (US)", {}], ["de_DE", "Deutsch", {}]]
      )
    end
  end

  describe "#marked_for_install" do
    it "returns the languages that are selected for installation" do
      expect(subject.marked_for_install).to eq(["de_DE"])
    end
  end

  describe "#select_to_install" do
    before do
      allow(backend).to receive(:language=)
    end

    it "selects the first given language for installation" do
      expect(backend).to receive(:language=).with("de_DE")
      subject.select_to_install(["de_DE", "en_US"])
    end

    it "returns true" do
      expect(subject.select_to_install(["de_DE"])).to eq(true)
    end

    context "when the language does not exists" do
      before do
        allow(backend).to receive(:language=).and_raise(Agama::Errors::InvalidValue)
      end

      it "returns false" do
        expect(subject.select_to_install(["unknown"])).to eq(false)
      end
    end
  end

  describe "#finish" do
    it "finishes the language installation" do
      expect(backend).to receive(:finish)
      subject.finish
    end
  end
end
