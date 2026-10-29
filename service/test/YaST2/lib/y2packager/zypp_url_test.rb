#!/usr/bin/env rspec
# frozen_string_literal: true

# Vendored from yast2's library/packages/test/y2packager/zypp_url_test.rb.
# This is a permanent fork (see service/YaST2/README.md): Y2Packager::ZyppUrl is vendored
# directly instead of depending on yast2-packager (which has a circular RPM Requires: on
# yast2-storage-ng).

require_relative "../../../test_helper"
require "uri"
require "y2packager/zypp_url"

describe Y2Packager::ZyppUrl do
  let(:https_s) { "https://example.com/path" }

  describe "#==" do
    it "returns true for the same ZyppUrl" do
      z = described_class.new(https_s)
      z2 = described_class.new(https_s.dup)
      expect(z == z2).to eq(true)
    end

    it "returns false for a different ZyppUrl" do
      z = described_class.new(https_s)
      z2 = described_class.new("https://example.com/different")
      expect(z == z2).to eq(false)
    end

    it "returns true for the same URI::Generic" do
      z = described_class.new(https_s)
      u = URI(https_s.dup)
      expect(z == u).to eq(true)
    end

    it "returns true for URI::Generic if the only difference is undefine/empty authority" do
      s1 = "dir:/foo"
      s3 = "dir:///foo"
      u1 = URI(s1)
      u3 = URI(s3)
      z1 = described_class.new(s1)

      expect(z1 == u1).to eq(true)
      expect(z1 == u3).to eq(true)
    end

    it "returns false for a different URI::Generic" do
      z = described_class.new(https_s)
      u = URI("https://example.com/different")
      expect(z == u).to eq(false)
    end

    # NOTE: even a String which looks the same will return false
    it "returns false for a different class" do
      u = described_class.new(https_s)

      expect(u == https_s).to eq(false)
    end
  end

  describe "#inspect" do
    it "returns a string" do
      z = described_class.new(https_s)
      expect(z.inspect).to be_a(String)
    end
  end
end
