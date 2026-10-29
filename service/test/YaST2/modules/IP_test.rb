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

Yast.import "IP"

describe Yast::IP do
  subject { Yast::IP }

  describe "#Check4" do
    VALID_IP4S = [
      "0.0.0.0",
      "127.0.0.1",
      "255.255.255.255",
      "10.11.12.13"
    ].freeze

    VALID_IP4S.each do |valid_ip4|
      it "returns true for valid IPv4 '#{valid_ip4}'" do
        expect(subject.Check4(valid_ip4)).to eq(true)
      end
    end

    INVALID_IP4S = [
      "0.0.0",
      "127.0.0.1.1",
      "256.255.255.255",
      "01.01.012.013",
      "10,11.12.13"
    ].freeze

    INVALID_IP4S.each do |invalid_ip4|
      it "returns false for invalid IPv4 '#{invalid_ip4}'" do
        expect(subject.Check4(invalid_ip4)).to eq(false)
      end
    end

    it "returns false for empty argument" do
      expect(subject.Check4("")).to eq(false)
    end

    it "returns false for nil argument" do
      expect(subject.Check4(nil)).to eq(false)
    end
  end

  describe "#Check6" do
    VALID_IP6S = [
      "1:2:3:4:5:6:7:8",
      "::3:4:5:6:7:8",
      "1:2:3:4:5:6::",
      "1:2:3::5:6:7:8",
      "1:2:3:4:5:6::8",
      "a:FF:b:c:d:d:e:e",
      "fe80::200:1cff:feb5:5433",
      "0::",
      "0000::",
      "0:1::",
      "1:0::",
      "1:0::0",
      "1:2:3:4:5:6:127.0.0.1",
      "1:2:3::6:127.0.0.1"
    ].freeze

    VALID_IP6S.each do |valid_ip6|
      it "returns true for valid IPv6 '#{valid_ip6}'" do
        expect(subject.Check6(valid_ip6)).to eq(true)
      end
    end

    INVALID_IP6S = [
      "1::3:4:5:6::8",
      "1:2:3:4:5:6:7:8:9",
      "1:2:3:4::5:6:7:8:9",
      ":2:3:4:5:6:7:8",
      "1:2:3:4:5:6:7:",
      "g:FF:b:c:d:d:e:e",
      "127.0.0.1",
      "1:2:3:4:5:6:7:127.0.0.1",
      "1:2:3::6:7:8:127.0.0.1"
      # FIXME: deprecated syntax, so we should handle it like invalid "::127.0.0.1",
      # FIXME: deprecated syntax, so we should handle it invalid "::FFFF:127.0.0.1",
      # FIXME: insufficient regex for ipv4 included in ipv6 "1:2:3:4:5:6:127.0.0.256"
    ].freeze

    INVALID_IP6S.each do |invalid_ip6|
      it "returns false for invalid IPv6 '#{invalid_ip6}" do
        expect(subject.Check6(invalid_ip6)).to eq(false)
      end
    end

    it "returns false for empty argument" do
      expect(subject.Check6("")).to eq(false)
    end

    it "returns false for nil argument" do
      expect(subject.Check6(nil)).to eq(false)
    end
  end

  describe "#ToInteger" do
    RESULT_MAP_INT = {
      "0.0.0.0"        => 0,
      "127.0.0.1"      => 2_130_706_433,
      "192.168.110.23" => 3_232_263_703,
      "10.20.1.29"     => 169_083_165
    }.freeze

    RESULT_MAP_INT.each_pair do |k, v|
      it "returns #{v} for #{k}" do
        # in 32bits arch IP#ToInteger returns Bignum, so equal? returns false
        # and eql? has to be used
        # in 64bits arch the result is Fixnum and the problem do not appear
        expect(subject.ToInteger(k)).to eq v
      end
    end

    it "returns nil if value is not valid IPv4 in dotted format" do
      expect(subject.ToInteger("foobar")).to eq nil
    end
  end

  describe "#ToString" do
    RESULT_MAP_INT.each_pair do |k, v|
      it "it returns #{k} for #{v}" do
        expect(subject.ToString(v)).to eq k
      end
    end
  end

  describe "#ToHex" do
    RESULT_MAP_HEX = {
      "0.0.0.0"         => "00000000",
      "10.10.0.1"       => "0A0A0001",
      "192.168.1.1"     => "C0A80101",
      "255.255.255.255" => "FFFFFFFF"
    }.freeze

    RESULT_MAP_HEX.each_pair do |k, v|
      it "returns #{v} for valid #{k}" do
        expect(subject.ToHex(k)).to eq v
      end
    end

    it "returns nil if value is not valid IPv4 in dotted format" do
      expect(subject.ToHex("foobar")).to eq nil
    end
  end

  RESULT_MAP_BITS = {
    "80.25.135.2"    => "01010000000110011000011100000010",
    "172.24.233.211" => "10101100000110001110100111010011"
  }.freeze

  describe "#IPv4ToBits" do
    RESULT_MAP_BITS.each_pair do |k, v|
      it "returns bitmap for #{k}" do
        expect(subject.IPv4ToBits(k)).to eq v
      end
    end

    it "returns nil if value is not valid IPv4" do
      expect(subject.IPv4ToBits("blabla")).to eq nil
    end
  end

  describe "#BitsToIPv4" do
    RESULT_MAP_BITS.each_pair do |k, v|
      it "returns #{k} for #{v}" do
        expect(subject.BitsToIPv4(v)).to eq k
      end
    end

    it "returns nil if length of bitmap is not 32" do
      expect(subject.BitsToIPv4("101")).to eq nil
    end

    it "returns nil if value is not valid bitmap with 0 or 1 only" do
      expect(subject.BitsToIPv4("foobar")).to eq nil
    end
  end

end
