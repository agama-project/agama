#!/usr/bin/env rspec

require_relative "test_helper"

require "yast"

describe "Hostname#CurrentFQ" do
  Yast.import "Hostname"
  Yast.import "FileUtils"

  let(:etc_hostname) { "etc.hostname.cz" }
  let(:cmd_hostname) { "cmd.hostname.cz" }
  let(:hostname)     { Yast::Hostname }

  def allow_execute_hostname(stdout, code = 0, stderr = "")
    ret = { "stdout" => stdout, "stderr" => stderr, "exit" => code }

    allow(Yast::SCR)
      .to receive(:Execute)
      .with(path(".target.bash_output"), "/usr/bin/hostname --fqdn")
      .and_return(ret)
  end

  def allow_read_hostname(result)
    allow(Yast::SCR)
      .to receive(:Read)
      .with(path(".target.string"), "/etc/hostname")
      .and_return(result)
  end

  it "returns output of hostname --fqdn if available" do
    allow_execute_hostname(cmd_hostname)

    expect(hostname.CurrentFQ).to eq cmd_hostname
  end

  it "reads /etc/hostname when hostname --fqdn fails" do
    allow_execute_hostname("", 1)
    allow_read_hostname(etc_hostname)

    allow(Yast::FileUtils)
      .to receive(:Exists)
      .with("/etc/hostname")
      .and_return(true)

    expect(hostname.CurrentFQ).to eq etc_hostname
  end
end
