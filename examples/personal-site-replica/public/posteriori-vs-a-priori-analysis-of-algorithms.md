<!-- generated-markdown-alternate -->
---
title: "A Posteriori vs A Priori Analysis of Algorithms"
description: "Two ways to measure algorithm performance: running benchmarks vs. mathematical analysis."
url: "https://briansunter.com/posteriori-vs-a-priori-analysis-of-algorithms"
---

AUG 21, 2022 · 2 MIN READ

# A Posteriori vs A Priori Analysis of Algorithms

Two ways to measure algorithm performance: running benchmarks vs. mathematical analysis.

There are two fundamental approaches to measuring how fast an algorithm runs: actually running it, or analyzing it mathematically.

## A Posteriori analysis (profiling)

The most straightforward way to measure algorithm speed is to run it and time it.

**A posteriori** is Latin for “from the later.” You run the algorithm first, then measure after.

Examples include benchmarking and profiling, where you run your program and record how long it takes in seconds. There are many tools for this kind of performance measurement.

You can also analyze memory usage and other resource consumption.

This approach is hardware dependent since you’re running a real program. Results also depend on the programming language. A program written in C will generally run faster than the same algorithm in JavaScript.

## A Priori analysis (time complexity)

Sometimes we want a theoretical measure of how long an algorithm takes without actually running it.

**A priori** is Latin for “from the earlier.” You analyze the algorithm before running it.

Some algorithms can be proven to always be faster than others, regardless of hardware. Since computers keep getting faster, it’s useful to know which algorithms will always be faster without retesting them on every new machine.

Time complexity analysis is the main example of a priori analysis. Bubble sort has a time complexity of . This is the same no matter what programming language or hardware you use.

## Comparison

| A Posteriori                           | A Priori                             |
| -------------------------------------- | ------------------------------------ |
| Hardware and language dependent        | Independent of language and hardware |
| Gives exact measurements               | Gives approximate bounds             |
| Uses seconds and bytes                 | Uses asymptotic notation (Big O)     |
| Results differ between systems         | Same for every system                |
| Improve by upgrading hardware/compiler | Improve by changing the algorithm    |

## Subscribe to newsletter

I send occasional emails about new blog posts, side projects, and things I'm learning.

By subscribing, you agree to our [Privacy Policy](/privacy).

[Older Time Complexity Analysis ](/time-complexity)[Newer Newsletter Issue 8](/newsletter/issue-8)

## Related

- [Recurrence Relation and Master's Theorem for Dividing Functions Jan 4, 2023](/recurrence-relation-masters-theorem-dividing)
- [Recurrence Relation and Master's Theorem for Subtracting Functions Jan 4, 2023](/recurrence-relation-masters-theorem-subtracting)
- [Algorithms and Data Structures Oct 3, 2022](/algorithms)

## Share this article
