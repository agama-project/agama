# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "agama/software/product"

describe Agama::Software::Product do
  subject do
    described_class.new("Test").tap do |product|
      product.user_patterns = [
        Agama::Software::UserPattern.new("kde", false),
        Agama::Software::UserPattern.new("selinux", true)
      ]
    end
  end

  describe "#localized_description" do
    before do
      subject.description = "Original description"
      subject.translations = {
        "description" => {
          "cs" => "Czech translation",
          "es" => "Spanish translation"
        }
      }
    end

    it "returns untranslated description when the language is not set" do
      allow(ENV).to receive(:[]).with("LANG").and_return(nil)

      expect(subject.localized_description).to eq("Original description")
    end

    it "returns Czech translation if locale is \"cs_CZ.UTF-8\"" do
      allow(ENV).to receive(:[]).with("LANG").and_return("cs_CZ.UTF-8")

      expect(subject.localized_description).to eq("Czech translation")
    end

    it "returns Czech translation if locale is \"cs\"" do
      allow(ENV).to receive(:[]).with("LANG").and_return("cs")

      expect(subject.localized_description).to eq("Czech translation")
    end

    it "return untranslated description when translation is not available" do
      allow(ENV).to receive(:[]).with("LANG").and_return("cs_CZ.UTF-8")
      subject.translations = {}

      expect(subject.localized_description).to eq("Original description")
    end
  end

  describe "#preselected_patterns" do
    it "returns the user preselected patterns" do
      expect(subject.preselected_patterns).to eq(["selinux"])
    end
  end
end
