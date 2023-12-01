/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { ListSearch } from "~/components/core";

const fruits = [
  { name: "Apple", color: "red", size: "medium" },
  { name: "Banana", color: "yellow", size: "medium" },
  { name: "Grape", color: "green", size: "small" },
  { name: "Pear", color: "green", size: "medium" }
];

const FruitList = ({ fruits }) => {
  const [filteredFruits, setFilteredFruits] = useState(fruits);

  return (
    <>
      <ListSearch elements={fruits} onChange={setFilteredFruits} />
      <ul>
        {filteredFruits.map((f, i) => <li key={i} role="option">{f.name}</li>)}
      </ul>
    </>
  );
};

it("searches for elements matching the given term (case-insensitive)", async () => {
  const { user } = plainRender(<FruitList fruits={fruits} />);

  const searchInput = screen.getByRole("search");

  // Search for "medium" size fruit
  await user.type(searchInput, "medium");
  await waitFor(() => (
    expect(screen.queryByRole("option", { name: /grape/ })).not.toBeInTheDocument())
  );
  screen.getByRole("option", { name: "Apple" });
  screen.getByRole("option", { name: "Banana" });
  screen.getByRole("option", { name: "Pear" });

  // Search for "green" fruit
  await user.clear(searchInput);
  await user.type(searchInput, "Green");
  await waitFor(() => (
    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeInTheDocument())
  );
  await waitFor(() => (
    expect(screen.queryByRole("option", { name: "Banana" })).not.toBeInTheDocument())
  );
  screen.getByRole("option", { name: "Grape" });
  screen.getByRole("option", { name: "Pear" });

  // Search for known fruit
  await user.clear(searchInput);
  await user.type(searchInput, "ap");
  await waitFor(() => (
    expect(screen.queryByRole("option", { name: "Banana" })).not.toBeInTheDocument())
  );
  await waitFor(() => (
    expect(screen.queryByRole("option", { name: "Pear" })).not.toBeInTheDocument())
  );
  screen.getByRole("option", { name: "Apple" });
  screen.getByRole("option", { name: "Grape" });

  // Search for unknown fruit
  await user.clear(searchInput);
  await user.type(searchInput, "tomato");
  await waitFor(() => (
    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeInTheDocument())
  );
  await waitFor(() => (
    expect(screen.queryByRole("option", { name: "Banana" })).not.toBeInTheDocument())
  );
  await waitFor(() => (
    expect(screen.queryByRole("option", { name: "Grape" })).not.toBeInTheDocument())
  );
  await waitFor(() => (
    expect(screen.queryByRole("option", { name: "Pear" })).not.toBeInTheDocument())
  );
});
