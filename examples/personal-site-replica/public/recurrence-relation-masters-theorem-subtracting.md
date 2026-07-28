<!-- generated-markdown-alternate -->
---
title: "Recurrence Relation and Master's Theorem for Subtracting Functions"
description: "The math behind figuring out time complexity for recursive algorithms using recurrence relations."
url: "https://briansunter.com/recurrence-relation-masters-theorem-subtracting"
---

JAN 4, 2023 · 6 MIN READ

# Recurrence Relation and Master's Theorem for Subtracting Functions

The math behind figuring out time complexity for recursive algorithms using recurrence relations.

![Cover image for Recurrence Relation and Master's Theorem for Subtracting Functions](/_astro/recurrence-subtracting-cover.BTzA2BcF_ZSPr8X.webp)

## Divide and Conquer

If a problem is large, divide the problem into subproblems, solve them, then recombine the solutions.

The subproblems should be the same type of problems. For example, if the main problem is sorting, then the subproblems are sorting.

### Examples of Divide and Conquer Problems

Binary search

Finding Maximum and Minimum

Merge Sort

Quick Sort

Strassen’s Matrix Multiplication

## Subtraction Recurrence Relation 1

### Recursive function example

js

```
function test(n) {
  if (n > 0) {
    console.log(n);
    test(n - 1);
  }
}
```

How many times is this function called?

`test(3)` -> prints “3”

`test(2)` -> prints “2”

`test(1)` -> prints “1”

`test(0)` -> does not print, or call itself again, since n is not greater than 0

Does work (printing) 3 times, but calls itself 4 times, where it doesn’t print on the last time.

If printing is one unit of time, then this takes 3 units of time.

So if you pass `n` it will make `n+1` calls, and print `n` times.

The time depends on the number of calls, so time complexity is .

How do we find the recurrence relation?

#### Deriving by substitution

Starting with , we substitute repeatedly to find a pattern.

**In terms of :** Substituting gives , so:

**In terms of :** Similarly, , so:

**Generalizing to steps:**

We know . Assuming (so ):

## Subtraction Recurrence Relation 2

js

```
function test(n) {
  if (n > 0) {
    for (let i = 0; i < n; i++) {
      console.log(n);
    }
    test(n - 1);
  }
}
```

Recurrence relation is

For each iteration, it takes units of time, then calls itself -1.

### Tree Method

![2022-12-01-13-33-20](/_astro/2022-12-01-13-33-20.Clu0M6oJ_Z1MVtj.svg)

2022-12-01-13-33-20

We can see the amount of work is

To find the total amount of work we can use the [integer-sum-formula](/integer-sum-formula)

This simplifies to for measuring time complexity.

### Substitution Method

Starting with , we substitute repeatedly:

Continuing for iterations:

Assuming (so ):

Using the [integer sum formula](/integer-sum-formula) and :

## Subtraction Recurrence Relation 3

js

```
function test(n) {
  if (n > 0) {
    for (let i = 1; i < n; i = i * 2) {
      console.log(n);
    }
    test(n - 1);
  }
}
```

We know `(let i=1; i< n; i=i*2)` will execute times.

### Tree Method

![2022-12-05-15-12-40](/_astro/2022-12-05-15-12-40.B39W83Sw_2rXTTj.svg)

2022-12-05-15-12-40

Amount of work is

-> log n factorial

Equivalent to

### Substitution method

Plug in n-2

Assume , therefore

Simplifies to

### Directly Get Answer

->

->

->

->

Just multiply the term after the + by n, since you know it will be repeated n times via recursion.

What if it’s not decreasing by 1? It still works.

-> ->

->

However, if there’s a coefficient on the function, it’s different though.

## Subtraction Recurrence Relation 4

js

```
function test(n) {
  if (n > 0) {
    console.log(n);
    test(n - 1);
    test(n - 1);
  }
}
```

### Tree Method

![2022-12-06-13-53-46](/_astro/2022-12-06-13-53-46.BDO3bSrX_2r88cX.svg)

2022-12-06-13-53-46

function called twice in first row

4 times in second row

8 times in third row

So the work done in each row is

In the series above, and

So we can use the formula above to find the answer for our tree

Simplifies to

Assume , so

So Big O is

### Substitution Method

Assume

## Master’s Theorem for Subtracting Functions

->

->

->

->

->

->

### Master’s Theorem

General form of recurrence relation

Assume

where

#### Case 1

For example

Then

also can be thought of as

#### Case 2

For example

Then

#### Case 3

If you’re decreasing by more than 1, for example

Then

What if for example .5

Then or

## Subscribe to newsletter

I send occasional emails about new blog posts, side projects, and things I'm learning.

By subscribing, you agree to our [Privacy Policy](/privacy).

[Older Books Read in 2022 ](/books-read-in-2022)[Newer Recurrence Relation and Master's Theorem for Dividing Functions](/recurrence-relation-masters-theorem-dividing)

## Related

- [Recurrence Relation and Master's Theorem for Dividing Functions Jan 4, 2023](/recurrence-relation-masters-theorem-dividing)
- [Algorithms and Data Structures Oct 3, 2022](/algorithms)
- [Time Complexity Analysis Aug 21, 2022](/time-complexity)

## Share this article
