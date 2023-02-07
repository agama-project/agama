
// helper function - convert component name to component group to group similar
// e.g. for "ui-macro" and "qt-ui" use the same "UI" filtering component
function component_group(name) {
  if (name === "zconfig" || name === "parser::yum" || name === "Progress++" ||
    name === "parser++" || name === "parser" || name === "FileChecker" ||
    name === "locks" || name === "locks++" || name === "MODALIAS++" ||
    name.match(/^zypp/) || name.match(/^librpm/)) {
    return "libzypp";
  } else if (name === "zypp::solver" || name.match(/^libsolv/)) {
    return "Solver";
  } else if (name === "Pkg" || name === "Pkg++") {
    return "Pkg-bindings";
  } else if (name === "bash" || name === "scr" || name.match(/^agent-/) || name.match(/^ag_/)) {
    return "Agents";
  } else if (name === "ui" || name === "libycp" || name.match(/^ui-/) || name.match(/-ui$/) || name.match(/^qt-/)) {
    return "UI";
  } else if (name === "liby2" || name === "wfm" || name === "liby2") {
    return "yast2-core";
  } else if (name === "Interpreter") {
    return "Ruby";
  } else {
    return name;
  }
}

// y2log parser
export default function y2logparser(y2log) {
  if (process.env.NODE_ENV !== "production") {
    console.time("Parsing y2log");
  }

  const lines = [];
  const components = new Set();
  // regexp for parsing y2log
  const log_regexp = /^(\d\d\d\d-\d\d-\d\d) (\d\d:\d\d:\d\d) <(\d)> ([^(]+)\((\d+)\) \[(\S+)\] (.*)/;

  y2log.split("\n").forEach((line) => {
    let res = line.match(log_regexp);

    if (res) {
      const entry = {
        date: res[1],
        time: res[2],
        level: res[3],
        host: res[4],
        pid: res[5],
        component: res[6],
        group: component_group(res[6]),
        message: res[7],
        location: null
      };

      // Ruby locations might contains spaces, parse it specifically
      res = entry.message.match(/^([^ ]*:\d+) (.*)/) ||
        entry.message.match(/^(.*\(block in .*\):\d+) (.*)/) ||
        entry.message.match(/^(.*\(block \(\d+ levels\) in .*\):\d+) (.*)/) ||
        entry.message.match(/^(.*\(ensure in .*\):\d+) (.*)/);

      if (res) {
        entry.location = res[1];
        entry.message = res[2];
      }

      components.add(entry.group);

      lines.push(entry);
    } else if (lines.length > 0) {
      // if the line does not match append it to previous line message,
      // it is a multiline message
      const last_item = lines[lines.length - 1];
      last_item.message = last_item.message ? last_item.message + "\n" + line : line;
      lines[lines.length - 1] = last_item;
    }
  });

  if (process.env.NODE_ENV !== "production") {
    console.timeEnd("Parsing y2log");
    console.log("Loaded " + lines.length + " lines");
  }

  return { lines, components };
}
