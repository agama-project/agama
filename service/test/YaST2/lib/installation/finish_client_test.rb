#! /usr/bin/env rspec

require_relative "test_helper"

require "installation/finish_client"

class TestFinish < ::Installation::FinishClient
  def info
    "info"
  end

  def write
    "write"
  end
end

describe ::Installation::FinishClient do
  subject { ::TestFinish }
  describe ".run" do
    it "raise ArgumentError exception if unknown first argument is passed" do
      allow(Yast::WFM).to receive(:Args).and_return(["Unknown", {}])
      expect { ::Installation::FinishClient.run }.to raise_error(ArgumentError)
    end

    context "first client argument is Info" do
      before do
        allow(Yast::WFM).to receive(:Args).and_return(["Info"])
      end

      it "dispatch call to abstract method info" do
        expect(subject.run).to eq "info"
      end

      it "raise NotImplementedError exception if abstract method not defined" do
        expect { ::Installation::FinishClient.run }.to raise_error(NotImplementedError)
      end
    end

    context "first client argument is Write" do
      before do
        allow(Yast::WFM).to receive(:Args).and_return(["Write"])
      end

      it "dispatch call to abstract method write" do
        expect(subject.run).to eq "write"
      end

      it "raise NotImplementedError exception if abstract method not defined" do
        expect { ::Installation::FinishClient.run }.to raise_error(NotImplementedError)
      end
    end
  end
end
