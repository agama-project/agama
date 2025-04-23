#! /usr/bin/env rspec
# frozen_string_literal: true

require_relative "../../test_helper"

require "agama/ssl/fingerprint"

describe Agama::SSL::Fingerprint do
  # checksum examples
  let(:sha1)   { "A8:DE:08:B1:57:52:FE:70:DF:D5:31:EA:E3:53:BB:39:EE:01:FF:B9" }
  let(:sha256) do
    "2A:02:DA:EC:A9:FF:4C:B4:A6:C0:57:08:F6:1C:8B:B0:94:FA:F4:" \
      "60:96:5E:18:48:CA:84:81:48:60:F3:CB:BF"
  end

  describe "== operator" do
    it "returns true when comparing self" do
      fp1 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1)
      fp2 = fp1
      expect(fp1).to eq(fp2)
    end

    it "returns true when comparing to the identical fingerprint" do
      fp1 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1)
      fp2 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1)
      expect(fp1 == fp2).to eq(true)
    end

    it "returns false when sum type does not match" do
      fp1 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1)
      fp2 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA256, sha1)
      expect(fp1 == fp2).to eq(false)
    end

    it "returns false when fingerprint value does not match" do
      fp1 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1)
      fp2 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha256)
      expect(fp1 == fp2).to eq(false)
    end

    it "compares the fingerprints case insensitively" do
      fp1 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1.downcase)
      fp2 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1.upcase)
      expect(fp1.value).to_not eq(fp2.value)
      expect(fp1 == fp2).to eq(true)
    end

    it "compares the sum types case insensitively" do
      fp1 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1.downcase, sha1)
      fp2 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1.upcase, sha1)
      expect(fp1.sum).to_not eq(fp2.sum)
      expect(fp1 == fp2).to eq(true)
    end

    it "ignores optional colon separator in fingerprints" do
      fp1 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1.tr(":", ""))
      fp2 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1)
      expect(fp1.value).to_not eq(fp2.value)
      expect(fp1 == fp2).to eq(true)
    end

    it "returns false when compared to nil" do
      fp1 = Agama::SSL::Fingerprint.new(Agama::SSL::Fingerprint::SHA1, sha1)
      expect(fp1).to_not eq(nil)
    end
  end
end
