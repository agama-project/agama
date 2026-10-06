# frozen_string_literal: true

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/none_bootloader"

describe Bootloader::NoneBootloader do
  include_context "yast2-bootloader test setup"

  describe "#name" do
    it "returns \"none\"" do
      expect(subject.name).to eq "none"
    end
  end

  describe "#summary" do
    it "returns array with single element" do
      expect(subject.summary).to eq(["<font color=\"red\">Do not install any boot loader</font>"])
    end
  end

  describe "#packages" do
    it "returns empty package list" do
      expect(subject.packages).to eq([])
    end
  end
end
