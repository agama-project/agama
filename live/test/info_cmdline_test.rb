#! /usr/bin/rspec
require "tmpdir"

describe "info-cmdline-conf.sh" do
  let(:script_path) { File.expand_path("../root/usr/bin/info-cmdline-conf.sh", __dir__, ) }

  context "There is no info parameter" do
    let(:source_path) { File.expand_path("fixtures/source/cmdline", __dir__, ) }
    let(:expected_path) { File.expand_path("fixtures/source/cmdline", __dir__, ) }


    it "does nothing" do
      Dir.mktmpdir do |tmpdir|
        target_path = File.join(tmpdir, "cmdline")
        FileUtils.cp(source_path, target_path)
        info_path = File.join(tmpdir, "cmdline.info")
        command = "#{script_path} #{target_path} #{info_path}"
        cmd_result = system(command)
        expect(cmd_result).to eq true
        expected = File.read(expected_path)
        result = File.read(target_path)
        expect(result).to eq expected
        expect(File.exists?(info_path)).to eq false
      end
    end
  end

  context "There is info parameter" do
    let(:source_path) { File.expand_path("fixtures/source/info_cmdline", __dir__, ) }
    let(:expected_path) { File.expand_path("fixtures/expected/info_cmdline", __dir__, ) }
    let(:expected_info_path) { File.expand_path("fixtures/expected/info_cmdline.info", __dir__, ) }

    it "removes info parameter and add its content" do
      Dir.mktmpdir do |tmpdir|
        target_path = File.join(tmpdir, "cmdline")
        FileUtils.cp(source_path, target_path)
        info_path = File.join(tmpdir, "cmdline.info")
        command = "#{script_path} #{target_path} #{info_path}"
        cmd_result = system(command)
        expect(cmd_result).to eq true
        expected = File.read(expected_path)
        result = File.read(target_path)
        expect(result).to eq expected

        expected_info = File.read(expected_info_path)
        result_info = File.read(info_path)
        expect(result_info).to eq expected_info
      end
    end
  end
end
