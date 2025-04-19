import { describe, it, expect } from "vitest";
import { bisectLeft, bisectRight, insort } from "./arrays.ts";

describe("bisectLeft", () => {
  it("should find the leftmost insertion point in a simple array", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(bisectLeft(arr, 3)).toBe(2);
    expect(bisectLeft(arr, 0)).toBe(0);
    expect(bisectLeft(arr, 6)).toBe(5);
  });

  it("should handle duplicate values correctly", () => {
    const arr = [1, 2, 2, 2, 3, 4, 5];
    expect(bisectLeft(arr, 2)).toBe(1); // First position of 2
  });

  it("should work with empty arrays", () => {
    expect(bisectLeft([], 1)).toBe(0);
  });

  it("should work with generic types and a getter function", () => {
    interface Person {
      name: string;
      age: number;
    }

    const people: Person[] = [
      { name: "Alice", age: 25 },
      { name: "Bob", age: 30 },
      { name: "Charlie", age: 30 },
      { name: "David", age: 35 },
      { name: "Eve", age: 40 },
    ];

    // Find by age
    expect(bisectLeft(people, 30, (person) => person.age)).toBe(1); // Alice (index 0) then Bob (index 1)
    expect(bisectLeft(people, 32, (person) => person.age)).toBe(3); // After Charlie, before David

    // Find by name (lexicographical order)
    const sortedByName = [...people].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    expect(bisectLeft(sortedByName, "Charlie", (person) => person.name)).toBe(
      2,
    );
  });

  it("should handle floating point values", () => {
    const arr = [1.1, 2.2, 3.3, 4.4, 5.5];
    expect(bisectLeft(arr, 3.3)).toBe(2);
    expect(bisectLeft(arr, 2.5)).toBe(2);
  });
});

describe("bisectRight", () => {
  it("should find the rightmost insertion point in a simple array", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(bisectRight(arr, 3)).toBe(3);
    expect(bisectRight(arr, 0)).toBe(0);
    expect(bisectRight(arr, 6)).toBe(5);
  });

  it("should handle duplicate values correctly", () => {
    const arr = [1, 2, 2, 2, 3, 4, 5];
    expect(bisectRight(arr, 2)).toBe(4); // After last position of 2
  });

  it("should work with empty arrays", () => {
    expect(bisectRight([], 1)).toBe(0);
  });

  it("should work with generic types and a getter function", () => {
    interface Person {
      name: string;
      age: number;
    }

    const people: Person[] = [
      { name: "Alice", age: 25 },
      { name: "Bob", age: 30 },
      { name: "Charlie", age: 30 },
      { name: "David", age: 35 },
      { name: "Eve", age: 40 },
    ];

    expect(bisectRight(people, 30, (person) => person.age)).toBe(3);
    expect(bisectRight(people, 32, (person) => person.age)).toBe(3); 

    const sortedByName = [...people].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    expect(bisectRight(sortedByName, "Charlie", (person) => person.name)).toBe(
      3,
    );
  });
});

describe("insort", () => {
  it("should insert items at the correct position", () => {
    let arr = [1, 3, 5, 7];
    arr = insort(arr, 4);
    expect(arr).toEqual([1, 3, 4, 5, 7]);

    arr = insort(arr, 0);
    expect(arr).toEqual([0, 1, 3, 4, 5, 7]);

    arr = insort(arr, 8);
    expect(arr).toEqual([0, 1, 3, 4, 5, 7, 8]);
  });

  it("should work with generic types and a getter function", () => {
    interface Task {
      id: number;
      priority: number;
    }

    let tasks: Task[] = [
      { id: 1, priority: 3 },
      { id: 2, priority: 5 },
      { id: 3, priority: 7 },
    ];

    // Insert by priority
    tasks = insort(tasks, { id: 4, priority: 4 }, (task) => task.priority);
    expect(tasks).toEqual([
      { id: 1, priority: 3 },
      { id: 4, priority: 4 },
      { id: 2, priority: 5 },
      { id: 3, priority: 7 },
    ]);
  });

  it("should insert items with duplicate values after existing duplicates", () => {
    const arr = [1, 2, 2, 2, 5];
    const newArr = insort(arr, 2);
    expect(newArr).toEqual([1, 2, 2, 2, 2, 5]);
  });
});
