#!/usr/bin/env rspec

require_relative "test_helper"

Yast.import "IP"

describe Yast::IP do
  subject { Yast::IP }

  describe "#Valid4" do
    it "must return valid IPv4 description" do
      expect(subject.Valid4).not_to be_empty
    end
  end

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

  describe "#reserved4" do
    it "raises exception for invalid IPv4 address" do
      expect { subject.reserved4(nil) }.to raise_error(RuntimeError)
      expect { subject.reserved4("0.0.0") }.to raise_error(RuntimeError)
    end

    it "returns true for address in 0.0.0.0/8 (RFC#1700)" do
      expect(subject.reserved4("0.0.0.0")).to be_equal true
      expect(subject.reserved4("0.1.0.0")).to be_equal true
      expect(subject.reserved4("0.0.1.0")).to be_equal true
      expect(subject.reserved4("0.0.0.1")).to be_equal true
      expect(subject.reserved4("0.255.255.255")).to be_equal true
    end

    it "returns true for address in 10.0.0.0/8 (RFC#1918)" do
      expect(subject.reserved4("10.0.0.0")).to be_equal true
      expect(subject.reserved4("10.1.0.0")).to be_equal true
      expect(subject.reserved4("10.0.1.0")).to be_equal true
      expect(subject.reserved4("10.0.0.1")).to be_equal true
      expect(subject.reserved4("10.255.255.255")).to be_equal true
    end

    it "returns true for address in 172.16.0.0/12 (RFC#1918)" do
      expect(subject.reserved4("172.16.0.0")).to be_equal true
      expect(subject.reserved4("172.25.152.153")).to be_equal true
      expect(subject.reserved4("172.31.255.255")).to be_equal true
    end

    it "returns true for address in 192.168.0.0/16 (RFC#1918)" do
      expect(subject.reserved4("192.168.0.0")).to be_equal true
      expect(subject.reserved4("192.168.152.153")).to be_equal true
      expect(subject.reserved4("192.168.255.255")).to be_equal true
    end

    it "returns true for address in 100.64.0.0/10 (RFC#6598)" do
      expect(subject.reserved4("100.64.0.0")).to be_equal true
      expect(subject.reserved4("100.100.0.0")).to be_equal true
      expect(subject.reserved4("100.111.111.111")).to be_equal true
      expect(subject.reserved4("100.127.255.255")).to be_equal true
    end

    it "returns true for address in 127.0.0.0/8 (RFC#5735)" do
      expect(subject.reserved4("127.168.0.0")).to be_equal true
      expect(subject.reserved4("127.100.0.0")).to be_equal true
      expect(subject.reserved4("127.111.111.111")).to be_equal true
      expect(subject.reserved4("127.255.255.255")).to be_equal true
    end

    it "returns true for address in 169.254.0.0/16 (RFC#5735)" do
      expect(subject.reserved4("169.254.0.0")).to be_equal true
      expect(subject.reserved4("169.254.0.0")).to be_equal true
      expect(subject.reserved4("169.254.111.111")).to be_equal true
      expect(subject.reserved4("169.254.255.255")).to be_equal true
    end

    it "returns true for address in 192.0.0.0/29 (RFC#6333)" do
      expect(subject.reserved4("192.0.0.0")).to be_equal true
      expect(subject.reserved4("192.0.0.4")).to be_equal true
      expect(subject.reserved4("192.0.0.7")).to be_equal true
    end

    it "returns true for address in 192.0.2.0/24 (RFC#5737)" do
      expect(subject.reserved4("192.0.2.0")).to be_equal true
      expect(subject.reserved4("192.0.2.124")).to be_equal true
      expect(subject.reserved4("192.0.2.255")).to be_equal true
    end

    it "returns true for address in 192.88.99.0/24 (RFC#3068)" do
      expect(subject.reserved4("192.88.99.0")).to be_equal true
      expect(subject.reserved4("192.88.99.124")).to be_equal true
      expect(subject.reserved4("192.88.99.255")).to be_equal true
    end

    it "returns true for address in 192.18.0.0/15 (RFC#2544)" do
      expect(subject.reserved4("192.18.0.0")).to be_equal true
      expect(subject.reserved4("192.19.0.0")).to be_equal true
      expect(subject.reserved4("192.19.255.255")).to be_equal true
    end

    it "returns true for address in 198.51.100.0/24 (RFC#5737)" do
      expect(subject.reserved4("198.51.100.0")).to be_equal true
      expect(subject.reserved4("198.51.100.124")).to be_equal true
      expect(subject.reserved4("198.51.100.255")).to be_equal true
    end

    it "returns true for address in 203.0.113.0/24 (RFC#5737)" do
      expect(subject.reserved4("203.0.113.0")).to be_equal true
      expect(subject.reserved4("203.0.113.124")).to be_equal true
      expect(subject.reserved4("203.0.113.255")).to be_equal true
    end

    it "returns true for address in 224.0.0.0/4 (RFC#5771)" do
      expect(subject.reserved4("224.0.0.0")).to be_equal true
      expect(subject.reserved4("230.0.113.124")).to be_equal true
      expect(subject.reserved4("239.255.255.255")).to be_equal true
    end

    it "returns true for address in 240.0.0.0/4 (RFC#5735)" do
      expect(subject.reserved4("240.0.0.0")).to be_equal true
      expect(subject.reserved4("250.0.113.124")).to be_equal true
      expect(subject.reserved4("255.255.255.255")).to be_equal true
    end

    it "returns false for address not reserved by any RFC" do
      expect(subject.reserved4("8.8.8.8")).to be_equal false
      expect(subject.reserved4("77.75.76.3")).to be_equal false
      expect(subject.reserved4("130.57.5.70")).to be_equal false
    end
  end
end
