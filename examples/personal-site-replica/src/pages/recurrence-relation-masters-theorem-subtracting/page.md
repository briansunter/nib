---
title: "Recurrence Relation and Master's Theorem for Subtracting Functions"
description: "The math behind figuring out time complexity for recursive algorithms using recurrence relations."
date: 2023-01-05T00:00:00.000Z
math: true
tags:
  - "algorithms"
  - "data-structures"
  - "programming"
  - "time-complexity"
layout: article
---
## Divide and Conquer

If a problem is large, divide the problem into subproblems, solve them, then recombine the solutions.

The subproblems should be the same type of problems. For example, if the main problem is sorting, then the subproblems are sorting.

### Examples of Divide and Conquer Problems

Binary search

Finding Maximum and Minimum

Merge Sort

Quick Sort

Strassen's Matrix Multiplication

## Subtraction Recurrence Relation 1

### Recursive function example

```js
function test(n) {
  if (n > 0) {
    console.log(n);
    test(n - 1);
  }
}
```

How many times is this function called?

`test(3)` -> prints "3"

`test(2)` -> prints "2"

`test(1)` -> prints "1"

`test(0)` -> does not print, or call itself again, since n is not greater than 0

Does work (printing) 3 times, but calls itself 4 times, where it doesn't print on the last time.

If printing is one unit of time, then this takes 3 units of time.

So if you pass `n` it will make `n+1` calls, and print `n` times.

The time depends on the number of calls, so time complexity is $O(n)$.

How do we find the recurrence relation?

$$
T(n) = \begin{cases}
1 & \text{when } n=1 \\\
T(n-1)+1 & \text{when } n > 0
\end{cases}
$$

#### Deriving $T(n)$ by substitution

Starting with $T(n)=T(n-1)+1$, we substitute repeatedly to find a pattern.

**In terms of $T(n-2)$:** Substituting $n-1$ gives $T(n-1)=T(n-2)+1$, so:
$$T(n) = [T(n-2)+1] +1 = T(n-2) + 2$$

**In terms of $T(n-3)$:** Similarly, $T(n-2)=T(n-3)+1$, so:
$$T(n) = [T(n-3) +1] + 2 = T(n-3)+3$$

**Generalizing to $k$ steps:** $T(n)=T(n-k)+k$

We know $T(0)=1$. Assuming $n-k=0$ (so $k=n$):
$$T(n)=T(0)+n = 1+n$$

## Subtraction Recurrence Relation 2

```js
function test(n) {
  if (n > 0) {
    for (let i = 0; i < n; i++) {
      console.log(n);
    }
    test(n - 1);
  }
}
```

Recurrence relation is $T(n) = T(n-1) + n$

$$T(n) = \begin{cases} 1 & \text{when } n=1 \\\ T(n-1)+n & \text{when } n > 0 \end{cases}$$

For each iteration, it takes $n$ units of time, then calls itself -1.

### Tree Method

![2022-12-01-13-33-20](/site-assets/2022-12-01-13-33-20.svg)

We can see the amount of work is $n + (n-1) + (n-2) ... + 1$

To find the total amount of work we can use the [[integer-sum-formula]]

$$\sum_{i=1}^n i = \frac{n(n + 1)}{2}$$

This simplifies to $O(n^2)$ for measuring time complexity.

### Substitution Method

Starting with $T(n) = T(n-1) + n$, we substitute repeatedly:

$$T(n-1)=T(n-2)+n-1 \implies T(n)=[T(n-2)+n-1]+n$$
$$T(n-2) = T(n-3) + n-2 \implies T(n) = T(n-3) + (n-2) + (n-1) + n$$

Continuing for $k$ iterations:
$$T(n) = T(n-k) + (n-k+1) + (n-k+2) + \cdots + (n-1) + n$$

Assuming $n-k=0$ (so $k=n$):
$$T(n)=T(0) + 1 + 2 + 3 + \cdots + n$$

Using the [[integer-sum-formula|integer sum formula]] $\sum_{i=1}^n i = \frac{n(n + 1)}{2}$ and $T(0)=1$:
$$T(n) = 1 + \frac{n(n + 1)}{2} = O(n^2)$$

## Subtraction Recurrence Relation 3

```js
function test(n) {
  if (n > 0) {
    for (let i = 1; i < n; i = i * 2) {
      console.log(n);
    }
    test(n - 1);
  }
}
```

We know `(let i=1; i< n; i=i*2)` will execute $log(n)$ times.

$$T(n) = \begin{cases} 1 & \text{when } n=0 \\\ T(n-1)+ log(n) & \text{when } n > 0 \end{cases}$$

### Tree Method

![2022-12-05-15-12-40](/site-assets/2022-12-05-15-12-40.svg)

Amount of work is $log(n) + log(n-1) + ... + log(2) + log(1)$

$log[n \cdot (n-1) \cdot (n-2) \cdot ... \cdot 2 \cdot 1]$

$log(n!)$ -> log n factorial

Equivalent to $O(nlog(n))$

### Substitution method

$T(n)=T(n-1) + log(n)$

Plug in n-2

$T(n)=[T(n-2)+log(n-1)] + log(n)$

$T(n)= [T(n-3)+log(n-2)]+log(n-1) + log(n)$

Assume $n-k=0$, therefore $n=k$

$T(n)=T(n-k) + log(1) + log(2) + ... + log(n-1) + log(n)$

Simplifies to

$T(n) = T(0) + log(n!)$

$T(n) = 1 + log(n!)$

$O(n log(n))$

### Directly Get Answer

$T(n)=T(n-1) + 1$ -> $O(n)$

$T(n) = T(n-1) + n$ -> $O(n^2)$

$T(n) = T(n-1) + log(n)$ -> $O(nlog(n))$

$T(n) = T(n-1) + n^2$ -> $O(n^3)$

Just multiply the term after the + by n, since you know it will be repeated n times via recursion.

What if it's not decreasing by 1? It still works.

$T(n) = T(n-2) + 1$ -> $n/2$ -> $O(n)$

$T(n) = T(n-100) + n$ -> $O(n^2)$

However, if there's a coefficient on the function, it's different though. $T(n) = 2*T(n-1) +1$

## Subtraction Recurrence Relation 4

```js
function test(n) {
  if (n > 0) {
    console.log(n);
    test(n - 1);
    test(n - 1);
  }
}
```

$T(n)=2T(n-1)+1$

$$T(n) = \begin{cases} 1 & \text{when } n=0 \\\ 2T(n-1)+1 & \text{when } n > 0 \end{cases}$$

### Tree Method

![2022-12-06-13-53-46](/site-assets/2022-12-06-13-53-46.svg)

function called twice in first row

4 times in second row

8 times in third row

So the work done in each row is $2^k$

$1 + 2 + 2^2 + 2^3 + ... + 2^k = n^{k+1}-1$

$$a + ar + ar^2 + ar^3 + ... + ar^k = \frac{a(r^{k+1}-1)}{r-1}$$

In the series above, $a=1$ and $r=2$

So we can use the formula above to find the answer for our tree

$$ \frac{1(2^{k+1}-1)}{2-1} $$

Simplifies to $2^{k+1}-1$

Assume $n-k=0$, so $n=k$

$2^{n+1}-1$

So Big O is $O(2^n)$

### Substitution Method

$T(n)=2T(n-1) + 1$

$T(n)=2[2T(n-2) +1] + 1$

$T(n) = 2^2T(n-2) + 2 + 1$

$T(n)=2^2[2T(n-3) +1] + 2 + 1$

$T(n) = 2^3 T(n-3) + 2^2 + 2 + 1$

$T(n)= 2^kT(n-k) + 2^{k-1}+2^{k-2} + ... + 2^2 + 2 + 1$

Assume $n-k=0$ $n=k$

$T(n) = 2^n T(0) + 1 + 2 + 2^2 + ... + 2^{k-1}$

$T(n) = 2^n * 1 + 2^k -1$

$T(n) = 2^n + 2^n -1$

$T(n) = 2^{n+1}-1$

$O(2^n)$

## Master's Theorem for Subtracting Functions

$T(n)=T(n-1) + 1$ -> $O(n)$

$T(n) = T(n-1) + n$ -> $O(n^2)$

$T(n) = T(n-1) + log(n)$ -> $O(nlog(n))$

$T(n) = 2T(n-1) + 1$ -> $O(2^n)$

$T(n) = 3T(n-1) + 1$ -> $O(3^n)$

$T(n) = 2T(n-1) + n$ -> $O(n * 3^n)$

### Master's Theorem

General form of recurrence relation

$T(n)=aT(n-b)+f(n)$

Assume

$a>0$

$b > 0$

$f(n)=O(n^k)$ where $k ≥ 0$

#### Case 1 $a=1$

For example $T(n)=T(n-1) + 1$

Then $O(n^{k+1})$

also can be thought of as $O(n*f(n))$

#### Case 2 $a>1$

For example $T(n) = 2T(n-1) + 1$

Then $O(n^k * a^n)$

#### Case 3 $a>1$

If you're decreasing by more than 1, for example $T(n) = 2T(n-2) + 1$

Then $O(n^k * a^{\frac{n}{b}})$

What if $a<1$ for example .5

Then $O(n^k)$ or $O(f(n))$
