#! /usr/bin/rspec
require "tmpdir"

describe "kernel-cmdline-conf.sh" do
  it "filters out any agama params" do
    script_path = File.expand_path("../root/usr/bin/kernel-cmdline-conf.sh", __dir__, )
    source_path = File.expand_path("fixtures/source/cmdline", __dir__, )
    expected_path = File.expand_path("fixtures/expected/cmdline", __dir__, )
    tmpdir = Dir.mktmpdir do |tmpdir|
      target_path = File.join(tmpdir, "cmdline")
      command = "#{script_path} #{source_path} #{target_path}"
      puts command
      cmd_result = system(command)
      expect(cmd_result).to eq true
      expected = File.read(expected_path)
      result = File.read(target_path)
      expect(result).to eq expected
    end
  end
end
