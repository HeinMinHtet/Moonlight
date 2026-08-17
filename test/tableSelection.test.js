import test from "node:test";
import assert from "node:assert/strict";
import { selectedRecordIds, syncRowSelection } from "../src/components/data-table/selection.js";

test("selectedRecordIds preserves the domain ID type", () => {
  const selected = selectedRecordIds([{ id: 42 }, { id: "record-b" }], { "42": true, "record-b": true });
  assert.deepEqual([...selected], [42, "record-b"]);
});

test("syncRowSelection emits only changed rows", () => {
  const changes = [];
  syncRowSelection(
    [{ id: 1 }, { id: 2 }, { id: 3 }],
    new Set([1, 2]),
    { "2": true, "3": true },
    (id, selected) => changes.push({ id, selected })
  );
  assert.deepEqual(changes, [{ id: 1, selected: false }, { id: 3, selected: true }]);
});
