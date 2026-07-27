---
title: "Algorithms and Data Structures"
description: "My notes on algorithms and data structures, from Big O basics to heaps and sorting."
date: 2022-10-04T00:00:00.000Z
tags:
  - "algorithms"
  - "data-structures"
  - "programming"
  - "time-complexity"
layout: article
---
A collection of notes on fundamental algorithms and data structures, covering time complexity analysis, sorting, searching, heaps, and more.

## Foundations

### [Time Complexity](/time-complexity)

Understanding how to analyze algorithm efficiency.

- What is an algorithm?
- [A Priori vs A Posteriori Analysis](/posteriori-vs-a-priori-analysis-of-algorithms)
- Frequency count method
- Asymptotic notation: Big O, Omega, and Theta
- Best, worst, and average case analysis

### [Recurrence Relations (Subtracting Functions)](/recurrence-relation-masters-theorem-subtracting)

Analyzing algorithms where subproblems reduce by $n-b$.

- Divide and conquer introduction
- Substitution method
- Tree method
- Master's Theorem for $T(n)=aT(n-b)+f(n)$

### [Recurrence Relations (Dividing Functions)](/recurrence-relation-masters-theorem-dividing)

Analyzing algorithms where subproblems reduce by $n/b$.

- Substitution method
- Tree method
- Master's Theorem for $T(n)=aT(\frac{n}{b})+f(n)$

## Searching

### [Binary Search](/binary-search)

Efficient searching in sorted arrays with $O(\log n)$ time complexity.

- Iterative implementation
- Recursive implementation
- Common variations and edge cases

## Data Structures

### [Heap](/heap)

A complete binary tree that satisfies the heap property.

- Array representation of binary trees
- Complete vs full binary trees
- Min heap and max heap
- Insertion and deletion
- Heap sort
- Heapify
- Priority queues

## Sorting

### Merge Sort

A divide-and-conquer sorting algorithm with $O(n \log n)$ time complexity.

- Two-way merge
- K-way merge
- Iterative merge sort

### Quick Sort

An efficient in-place sorting algorithm with average $O(n \log n)$ time complexity.

## More Resources

See also my [Data Structures and Algorithms Guide](/data-structures-algorithms-guide) for a comprehensive overview of topics and problems.
