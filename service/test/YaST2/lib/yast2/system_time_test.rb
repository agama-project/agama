#!/usr/bin/env rspec

require_relative "test_helper"
require_relative "../src/lib/yast2/system_time"

describe "SystemTime" do

  describe "#uptime" do
    it "returns a time stamp" do
      expect(Yast2::SystemTime.uptime).to be_a_kind_of(Numeric)
    end
  end
end
