---
title: "Integer Sum Formula (Gauss Sum)"
description: "The classic Gauss formula for summing consecutive integers, and why it matters for algorithm analysis."
date: 2022-10-02T00:00:00.000Z
math: true
tags:
  - "algorithms"
  - "math"
layout: article
---
How do we find the sum of the numbers 1 through 100?

For example, $1 + 2 + 3 + ... + 100$

In code this would look like:

```js
let sum = 0;
for (let i = 1; i <= 100; i++) {
  sum += i;
}
```

If you sum up these numbers, the result is $5050$.

## Sum of n integers equation

Instead of adding up the numbers 1 through $n$ by hand or in a loop, we can use an equation to find the answer instantly.

This is the equation for the sum of integers 1 through $n$:

$$\sum_{i=1}^n i = \frac{n(n + 1)}{2}$$

We can use this equation to find the sum of numbers 1 through 100:

$$1+2+3+...+ 100 = \frac{100(100 + 1)}{2}$$

Doing the calculation:

$$\frac{100(100 + 1)}{2} = \frac{10100}{2}=5050$$

## Proof

### Visual proof

One way to understand this is to imagine stacking boxes like stairs. You have one box, then two boxes stacked, then three, and so on.

![Staircase of boxes from 1 to n, forming a triangular shape](/site-assets/2022-10-09-08-39-52.svg)

The bottom and side are both length $n$. We need to find the "area" to get the total sum.

We can create a rectangle by duplicating this stack and flipping it upside down:

![Two staircases combined into a rectangle of size n by (n+1)](/site-assets/2022-10-09-09-07-45.svg)

![The combined rectangle showing dimensions n and n+1](/site-assets/image_1665465573710_0.png)

Notice that by flipping it, one side is $n$ and the other is $n + 1$.

The area of a rectangle is length times width, which gives us $n(n+1)$.

We divide by two because we only want the original staircase (half the rectangle).

This gives us the final equation: $\frac{n(n+1)}{2}$

### Proof by induction

#### Base case

The base case is the sum of just the first number, so let $n=1$:

$$\sum_{i=1}^1 i = \frac{1(1 + 1)}{2}=\frac{2}{2} = 1$$

This checks out.

#### Inductive step

Now let's find the next sum in terms of $n+1$:

$$\sum_{i=1}^{n+1} i $$

To find the next sum, we take the sum so far and add the next number to it:

$$\sum_{i=1}^{n} i + (n + 1)$$

We replace the summation with the original equation and simplify:

$$ \frac{n(n + 1)}{2}+ (n + 1)$$

To add these terms, we need a common denominator. We replace $(n+1)$ with the equivalent $\frac{2(n + 1)}{2}$:

$$ \frac{n(n + 1)}{2}+ \frac{2(n + 1)}{2}$$

Factor out $(n+1)$ from both terms:

$$\frac{(n + 1)(n + 2)}{2}$$

We can rewrite this to match the original equation's form:

$$ \sum_{i=1}^{n+1} i = \frac{(n + 1)((n + 1) +1)}{2}$$

This looks like the original equation with $(n + 1)$ substituted for $n$:

- Original: $\frac{n(n + 1)}{2}$
- With $n+1$: $\frac{(n + 1)((n + 1) +1)}{2}$

This completes the induction. We've shown the base case holds, and that if the formula works for $n$, it also works for $n+1$. Therefore the formula works for all positive integers.

## Resources

- [Sum of n, n², or n³ | Brilliant Math & Science Wiki](https://brilliant.org/wiki/sum-of-n-n2-or-n3)
