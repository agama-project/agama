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

require_relative "../test_helper"
require "agama/luks_activation_question"

describe Agama::LuksActivationQuestion do
  describe ".new" do
    it "creates a question with the text to ask for a LUKS activation" do
      question = described_class.new("/dev/sda1")
      expect(question.text).to match(/device \/dev\/sda1 is encrypted/)

      question = described_class.new("/dev/sda1", label: "mydata")
      expect(question.text).to match(/device \/dev\/sda1 mydata is encrypted/)

      question = described_class.new("/dev/sda1", size: "5 GiB")
      expect(question.text).to match(/device \/dev\/sda1 \(5 GiB\) is encrypted/)

      question = described_class.new("/dev/sda1", label: "mydata", size: "5 GiB")
      expect(question.text).to match(/device \/dev\/sda1 mydata \(5 GiB\) is encrypted/)
    end
  end

  subject { described_class.new("/dev/sda1") }

  it "has no default option" do
    expect(subject.default_option).to be_nil
  end

  describe "#options" do
    it "returns :skip and :decrypt" do
      expect(subject.options).to contain_exactly(:skip, :decrypt)
    end
  end
end
