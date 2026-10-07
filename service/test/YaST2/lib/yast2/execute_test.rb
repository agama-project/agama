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

require_relative "../../../test_helper"

require "yast2/execute"

Yast.import "Report"

describe Yast::Execute do
  before do
    allow(Yast::Report).to receive(:Error)
  end

  it "sets yast logger as cheetah logger" do
    expect(Cheetah.default_options[:logger]).to eq Yast::Y2Logger.instance
  end

  describe "#locally" do
    it "returns a chaining object if no argumens are given" do
      expect(subject.locally).to be_a(Yast::Execute)
    end

    it "passes arguments directly to cheetah" do
      expect(Cheetah).to receive(:run).with("ls", "-a")

      subject.locally("ls", "-a")
    end

    it "report error if command execution failed" do
      expect(Yast::Report).to receive(:Error)
      subject.locally("false")
    end

    it "returns nil if command execution failed" do
      expect(subject.locally("false")).to eq nil
    end
  end

  describe "#locally!" do
    it "returns a chaining object if no argumens are given" do
      expect(subject.locally).to be_a(Yast::Execute)
    end

    it "passes arguments directly to cheetah" do
      expect(Cheetah).to receive(:run).with("ls", "-a")

      subject.locally("ls", "-a")
    end

    it "raises Cheetah::ExecutionFailed if command execution failed" do
      expect { subject.locally!("false") }.to raise_error(Cheetah::ExecutionFailed)
    end
  end

  describe "#on_target" do
    it "returns a chaining object if no argumens are given" do
      expect(subject.on_target).to be_a(Yast::Execute)
    end

    it "adds to passed arguments chroot option if scr chrooted" do
      allow(Yast::WFM).to receive(:scr_root).and_return("/mnt")
      opts = { chroot: "/mnt" }
      expect(Cheetah).to receive(:run).with("ls", "-a", opts)

      subject.on_target("ls", "-a")
    end

    it "report error if command execution failed" do
      expect(Yast::Report).to receive(:Error)
      subject.on_target("false")
    end

    it "returns nil if command execution failed" do
      expect(subject.on_target("false")).to eq nil
    end
  end

  describe "#on_target!" do
    it "returns a chaining object if no argumens are given" do
      expect(subject.on_target!).to be_a(Yast::Execute)
    end

    it "adds to passed arguments chroot option if scr chrooted" do
      allow(Yast::WFM).to receive(:scr_root).and_return("/mnt")
      opts = { chroot: "/mnt" }
      expect(Cheetah).to receive(:run).with("ls", "-a", opts)

      subject.on_target("ls", "-a")
    end

    it "raises Cheetah::ExecutionFailed if command execution failed" do
      expect { subject.on_target!("false") }.to raise_error(Cheetah::ExecutionFailed)
    end
  end

  describe "#stdout" do
    it "returns a chaining object if no argumens are given" do
      expect(subject.stdout).to be_a(Yast::Execute)
    end

    it "captures stdout of the command" do
      opts = { stdout: :capture }
      expect(Cheetah).to receive(:run).with("ls", "-a", opts)

      subject.stdout("ls", "-a")
    end

    it "returns an empty string if command execution failed" do
      expect(subject.stdout("false")).to eq("")
    end

    context "when chaining with #locally" do
      it "report error if command execution failed" do
        expect(Yast::Report).to receive(:Error)
        subject.locally.stdout("false")
      end

      it "returns nil if command execution failed" do
        expect(subject.locally.stdout("false")).to be_nil
      end
    end

    context "when chaining with #on_target" do
      it "report error if command execution failed" do
        expect(Yast::Report).to receive(:Error)
        subject.on_target.stdout("false")
      end

      it "returns nil if command execution failed" do
        expect(subject.on_target.stdout("false")).to be_nil
      end
    end

    context "when chaining with #locally!" do
      it "does not raise an exception if command execution failed" do
        expect { subject.locally!.stdout("false") }.to_not raise_error
      end

      it "returns an empty string if command execution failed" do
        expect(subject.locally!.stdout("false")).to eq("")
      end
    end

    context "when chaining with #on_target!" do
      it "does not raise an exception if command execution failed" do
        expect { subject.on_target!.stdout("false") }.to_not raise_error
      end

      it "returns an empty string if command execution failed" do
        expect(subject.on_target!.stdout("false")).to eq("")
      end
    end
  end
end

describe Yast::ReducedRecorder do
  let(:logger) { double(debug: nil, info: nil, warn: nil, error: nil) }

  it "skips logging stdin if :stdin is passed" do
    expect(logger).to_not receive(:info).with(/secret/i)
    recorder = described_class.new(skip: :stdin, logger: logger)

    Yast::Execute.locally!("echo", stdin: "secret", recorder: recorder)
  end

  it "skips logging stdout if :stdout is passed" do
    expect(logger).to_not receive(:info).with(/secret/i)
    recorder = described_class.new(skip: [:stdout, :args], logger: logger)

    Yast::Execute.locally!("echo", "secret", recorder: recorder)
  end

  it "skips logging stderr if :stderr is passed" do
    expect(logger).to_not receive(:error).with(/secret/i)
    recorder = described_class.new(skip: [:stderr, :args], logger: logger)

    Yast::Execute.locally!("cat", "/dev/supersecretfile", recorder: recorder,
      allowed_exitstatus: 1)
  end

  it "skips logging of arguments if :args are passed" do
    expect(logger).to_not receive(:info).with(/secret/i)
    recorder = described_class.new(skip: [:args], logger: logger)

    Yast::Execute.locally!("false", "secret", recorder: recorder,
      allowed_exitstatus: 1)
  end
end
