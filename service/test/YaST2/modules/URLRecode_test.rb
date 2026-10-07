#!/usr/bin/env rspec

require_relative "test_helper"

Yast.import "URLRecode"

describe Yast::URLRecode do
  subject { Yast::URLRecode }

  describe "#EscapePath" do
    let(:test_path) { "/@\#%^&/dir/\u010D\u00FD\u011B\u0161\u010D\u00FD\u00E1/file" }
    it "returns nil if the url is nil too" do
      expect(subject.EscapePath(nil)).to eq(nil)
    end

    it "returns empty string if the url is empty too" do
      expect(subject.EscapePath("")).to eq("")
    end

    it "returns escaped path" do
      expect(subject.EscapePath(test_path)).to eq(
        "/%40%23%25%5e%26/dir/%c4%8d%c3%bd%c4%9b%c5%a1%c4%8d%c3%bd%c3%a1/file"
      )
    end

    it "returns unchanged path while calling EscapePath and UnEscape" do
      expect(subject.UnEscape(subject.EscapePath(test_path))).to eq(test_path)
    end

    it "returns escaped special characters" do
      expect(subject.EscapePath(" !@\#%^&*()/?+=:")).to eq(
        "%20!%40%23%25%5e%26*()/%3f%2b%3d:"
      )
    end

    it "does not escape '$'" do
      expect(subject.EscapePath("path/to/%SUSE%/$releasever"))
        .to eq("path/to/%25SUSE%25/$releasever")
    end
  end

  describe "#EscapePassword" do
    it "returns escaped special characters" do
      expect(subject.EscapePassword(" !@\#$%^&*()/?+=<>[]|\"")).to eq(
        "%20!%40%23%24%25%5e%26*()%2f%3f%2b%3d%3c%3e%5b%5d%7c%22"
      )
    end
  end

  describe "#EscapeQuery" do
    it "returns escaped special characters" do
      expect(subject.EscapeQuery(" !@\#$%^&*()/?+=")).to eq(
        "%20!%40%23%24%25%5e&*()/%3f%2b="
      )
    end
  end
end
