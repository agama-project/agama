// function go throught lshw output and enlist only given class.
// Basically it is same as calling `lshw -class <class>`.
selectClass(lshw, class)::
  local selectClass_(parent, class) =
    if std.objectHas(parent, 'class') && parent.class == class then
      [ parent ]
    else if std.objectHas(parent, 'children') then
      std.flattenArrays(std.prune(std.map(function(x) selectClass_(x, class), parent.children )))
    else
      [];

  local result = selectClass_(lshw, class);
  result,

// function go throught lshw output and returns object with given "id" or null if not found.
findID(lshw, id)::
  local findID_(parent, id) =
    if std.objectHas(parent, 'id') && parent.id == id then
      [parent]
    else if std.objectHas(parent, 'children') then
      std.flattenArrays(std.prune(std.map(function(x) findID_(x, id), parent.children )))
    else
      null;

  local result = findID_(lshw, id);
  if std.length(result) > 0 then result[0] else null,
