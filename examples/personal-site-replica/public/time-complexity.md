<!-- generated-markdown-alternate -->
---
title: "Time Complexity Analysis"
description: "What Big O notation actually means, how to compare algorithm efficiency, and the difference between O, Theta, and Omega."
url: "https://briansunter.com/time-complexity"
---

AUG 21, 2022 · 10 MIN READ

# Time Complexity Analysis

What Big O notation actually means, how to compare algorithm efficiency, and the difference between O, Theta, and Omega.

## Introduction to algorithms

### Algorithms vs programs

| Algorithm              | Program                                              |
| ---------------------- | ---------------------------------------------------- |
| Focused on design      | Implementation in a programming language on hardware |
| Domain knowledge       | Software engineering                                 |
| Language independent   | Specific language                                    |
| Analyzed theoretically | Tested empirically                                   |

## Priori vs posteriori analysis

See my detailed notes on [a posteriori vs a priori analysis](/posteriori-vs-a-priori-analysis-of-algorithms).

**A priori analysis** is theoretical, hardware independent, and language independent. We analyze time and space as mathematical functions.

**A posteriori analysis** measures actual execution time and memory usage on real hardware.

## Algorithm characteristics

### Input

Algorithms can take zero or more inputs.

### Output

Algorithms must generate some result. If an algorithm doesn’t produce output, it’s not useful. Even a void function should have some observable effect, like modifying a variable.

### Definiteness

Everything should be unambiguous and clear. If you can’t describe the problem to a human, you don’t understand it well enough to write an algorithm.

For example, you can’t pass an imaginary number like without specifying how to handle it.

### Finiteness

Algorithms must terminate at some point. A web server that runs indefinitely is a program, not an algorithm. Programs may use algorithms internally.

### Effectiveness

Don’t include unnecessary steps. In chemistry, you wouldn’t boil a chemical and then not use it in the experiment.

## How to write and analyze algorithms

### Swapping two numbers

Here’s pseudocode for swapping two values:

Note

This particular function only works for languages that support “pass by reference” like C/C++. Read more [here](https://www.javadude.com/articles/passbyvalue.htm).

js

```
function swap(a, b) {
  tmp = a;
  a = b;
  b = tmp;
}
```

### Criteria for analyzing algorithms

Time and space are the most important criteria.

**Time**: How long will the algorithm take to run?

**Space**: How much memory does the algorithm need?

Other characteristics may matter in specific contexts:

- **Network traffic**: How much data is sent over the network?
- **Power**: How much energy does the algorithm consume? (Important for mobile devices)
- **CPU registers**: For low-level software, you may need to know hardware details.

### Time analysis

Every “simple” statement takes one “unit” of time. A procedure with 3 simple statements takes 3 units of time, written as .

This is a **constant** value. It doesn’t matter what input you give it.

For simplicity, we usually say `y = 3*a + 6*b` is just 1 unit of time. It’s not necessary to count every operation.

### Space analysis

What’s the space complexity of the swap function? It uses 3 variables always, regardless of input, so which is constant.

Each variable is one “unit” of space.

## Frequency count method

The time taken by an algorithm can be determined by assigning one “unit” of time for each statement. If a statement repeats, the frequency of execution determines the time.

### Sum of elements in array

js

```
function sumArray(nums) {
  sum = 0;
  for (i = 0; i < nums.length; i++) {
    sum = sum + nums[i];
  }
  return sum;
}
```

**Time complexity**: Given an array of length n, the sum operation runs n times, so the algorithm takes time. We call this “order of n.”

**Space complexity**: We have variables `sum`, `i`, and `nums`. The array `nums` has n units of space, while `i` and `sum` each have 1 unit. Since `nums` dominates, the space complexity is .

### Matrix addition

js

```
function addMatrix(a, b) {
  for (i = 0; i < a.length; i++) {
    for (j = 0; j < a[0].length; j++) {
      c[i][j] = a[i][j] + b[i][j];
    }
  }
}
```

**Time complexity**: Two nested for loops, each running n times. That’s n procedures executing n times, giving us .

**Space complexity**: Three matrices (`a`, `b`, `c`) and two scalar variables (`i`, `j`).

## Time complexity patterns

How do we analyze time complexity for different code patterns?

### Normal for loops

The statement executes n times, so it’s :

js

```
for (i = 0; i < n; i++) {
  stmt();
}
```

### Decrementing for loop

Even though `i` decrements, the statement still executes n times, so it’s :

js

```
for (i = n; i > 0; i--) {
  stmt();
}
```

### Increment by two

js

```
for (i = 0; i < n; i += 2) {
  stmt();
}
```

This executes n/2 times. It’s still because constants are dropped.

### Nested for loops

js

```
for (i = 0; i < n; i++) {
  for (j = 0; j < n; j++) {
    stmt();
  }
}
```

Each loop executes n times, so the statement runs times, giving .

### Dependent for loops

What if the inner loop depends on the outer loop?

js

```
for (i = 0; i < n; i++) {
  for (j = 0; j < i; j++) {
    stmt();
  }
}
```

Let’s trace the values:

| i | j values     | stmt executions |
| - | ------------ | --------------- |
| 0 | (none)       | 0               |
| 1 | 0            | 1               |
| 2 | 0, 1         | 2               |
| 3 | 0, 1, 2      | 3               |
| … | …            | …               |
| n | 0, 1, …, n-1 | n               |

How many times does `stmt` execute? This is equivalent to .

Using the [integer sum formula](/integer-sum-formula):

This simplifies to because we only care about the highest power.

### Non-linear loop termination

js

```
p = 0;
for (i = 1; p <= n; i++) {
  p = p + i;
  stmt();
}
```

Let’s trace the values:

| i | p       |
| - | ------- |
| 1 | 1       |
| 2 | 3       |
| 3 | 6       |
| 4 | 10      |
| k | 1+2+…+k |

Using the [integer sum formula](/integer-sum-formula), .

The loop stops when :

This simplifies to , so .

The time complexity is .

### Multiply i value

js

```
for (i = 1; i < n; i = i * 2) {
  stmt();
}
```

| iteration | i |
| --------- | - |
| 1         | 1 |
| 2         | 2 |
| 3         | 4 |
| 4         | 8 |

The pattern is . The loop stops when :

The time complexity is .

### Divide i value

js

```
for (i = n; i >= 1; i = i / 2) {
  stmt();
}
```

The sequence is

The loop stops when :

The time complexity is .

## While loops and conditionals

We can analyze functions with while loops and if statements by tracing values:

js

```
while (m != n) {
  if (m > n) {
    m = m - n;
  } else {
    n = n - m;
  }
}
```

| m (starting at 16) | n |
| ------------------ | - |
| 14                 | 2 |
| 12                 | 2 |
| 10                 | 2 |
| 8                  | 2 |
| 6                  | 2 |
| 4                  | 2 |
| 2                  | 2 |

With input 16, it runs 7 times (16/2 - 1). The time complexity is .

## Classes of functions

These are listed in increasing order of growth:

| Class        | Notation | Example             |
| ------------ | -------- | ------------------- |
| Constant     |          |                     |
| Logarithmic  |          | Binary search       |
| Square root  |          | Some prime checks   |
| Linear       |          | Simple loop         |
| Linearithmic |          | Merge sort          |
| Quadratic    |          | Nested loops        |
| Cubic        |          | Triple nested loops |
| Exponential  |          | Recursive Fibonacci |

### Sample values

|   |   |    |     |
| - | - | -- | --- |
| 0 | 1 | 1  | 2   |
| 1 | 2 | 4  | 4   |
| 2 | 4 | 16 | 16  |
| 3 | 8 | 64 | 256 |

Exponential functions grow much faster. When n gets large, will always be less than .

*Image credit: [Cmglee](https://commons.wikimedia.org/wiki/File:Comparison_computational_complexity.svg)*

## Asymptotic notation

### Big O () - Upper bound

means there exist positive constants c and k such that for all .

If you graph the bounding function, your function’s value is always less than the Big O upper bound.

![Big O notation showing function bounded above by c\*g(n)](/_astro/image_1666066293557_0.BCo2pP_C_23XVYH.webp)

Big O notation showing function bounded above by c\*g(n)

*Source: [NIST](https://xlinux.nist.gov/dads/HTML/theta.html)*

For example, if , then for large n, so .

Use the closest function for the upper bound. Even though could be an upper bound for a linear function, it’s less useful.

### Big Omega () - Lower bound

Similar to Big O, but your function is always greater than the omega function.

means there exist positive constants c and k such that for all .

![Big Omega notation showing function bounded below](/_astro/image_1666138709938_0.zWvzFCB8_Sjg5v.webp)

Big Omega notation showing function bounded below

### Theta () - Tight bound

means there exist positive constants , , and k such that for all .

For :

So .

Since this is a tight bound, you can’t use for a linear function.

![Theta notation showing function bounded above and below](/_astro/image_1666139032348_0.DQLDsFTh_1fl4Sh.webp)

Theta notation showing function bounded above and below

## Properties of asymptotic notation

### General property

If , then for any constant a.

Example: is , and is also .

### Reflexive property

Example:

### Transitive property

If and , then .

If g(n) is an upper bound for f(n), and h(n) is an upper bound for g(n), then h(n) is also an upper bound for f(n).

### Symmetric property (Theta only)

If , then .

### Transpose symmetric property (O and Omega)

If , then .

Example: and

### Combining functions

If and :

- Addition:
- Multiplication:

## Comparing functions

To determine which function is the upper bound, we can sample values or apply logarithms.

For vs :

| n |    |    |
| - | -- | -- |
| 2 | 4  | 8  |
| 3 | 9  | 27 |
| 4 | 16 | 64 |

Applying log to both sides:

vs

vs

We can see that , so .

### Logarithm rules

-
-
-
-
- If , then

## Best, worst, and average case

### Linear search

Given a list `[8, 6, 12, 5, 9, 7, 4, 3, 16, 18]` and searching for `7`:

Linear search starts at the first element and checks each one, moving left to right.

**Best case**: Element is at the first index. Time is .

**Worst case**: Element is at the last index or not present. Time is .

**Average case**: We sum the time for all possible positions and divide by the number of cases.

If the element is at position 1, we do 1 comparison. At position 2, 2 comparisons. And so on.

Total comparisons:

Using the [integer sum formula](/integer-sum-formula):

Dividing by n cases:

This is the average case time.

### Note on notation

Don’t confuse best/worst/average case with Big O/Omega/Theta. Best case can be expressed using any of these notations:

- Best case = 1
- Best case =
- Best case =
- Best case =

### Binary search

![Binary search tree with root 20](/_astro/Screenshot_2022-11-28_at_2.22.08_PM_1669681356817_0.DlvQ5xRq_Z2drLm4.webp)

Binary search tree with root 20

If searching for `15`, start at root `20`. Is 15 smaller? Yes, go left. Check `10`. Is 15 larger? Yes, go right.

**Best case**: Element is the root. Time is .

**Worst case**: Element is a leaf. Time is the height of the tree, which is for a balanced tree.

### Unbalanced binary search tree

![Left-skewed binary search tree](/_astro/Screenshot_2022-11-28_at_2.28.42_PM_1669681918917_0.D3Oqr1ii_i5Ygu.webp)

Left-skewed binary search tree

A binary tree can be unbalanced. This left-skewed tree has height n.

Best case is still when the element is at the root.

However, worst case is because the height is n, compared to for a balanced tree.

## Subscribe to newsletter

I send occasional emails about new blog posts, side projects, and things I'm learning.

By subscribing, you agree to our [Privacy Policy](/privacy).

[Older How to manage projects in Logseq ](/logseq-projects)[Newer A Posteriori vs A Priori Analysis of Algorithms](/posteriori-vs-a-priori-analysis-of-algorithms)

## Related

- [Recurrence Relation and Master's Theorem for Dividing Functions Jan 4, 2023](/recurrence-relation-masters-theorem-dividing)
- [Recurrence Relation and Master's Theorem for Subtracting Functions Jan 4, 2023](/recurrence-relation-masters-theorem-subtracting)
- [Algorithms and Data Structures Oct 3, 2022](/algorithms)

## Share this article
