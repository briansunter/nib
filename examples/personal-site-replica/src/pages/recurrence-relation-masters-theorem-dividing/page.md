---
title: "Recurrence Relation and Master's Theorem for Dividing Functions"
description: "How to use the Master's Theorem to figure out the time complexity of divide-and-conquer algorithms like merge sort."
date: 2023-01-05T00:00:00.000Z
math: true
cover: "/site-assets/recurrence-masters-theorem-cover.png"
wordCount: 1540
tags:
  - "algorithms"
  - "data-structures"
  - "programming"
  - "time-complexity"
layout: article
---
## Dividing Recurrence Relation 1

```js
function test(n) {
  if (n > 1) {
    console.log(n);
    test(n / 2);
  }
}
```

When a function takes a parameter n, it can make it smaller by either subtracting like $n-1$ or dividing like $n/2$ or $\sqrt{n}$.

Amount of work is $T(n)=T(n/2) + 1$

### Recurrence Relation Dividing

$$T(n) = \begin{cases} 1 & \text{when } n=1 \\\ 2T(n/2)+n & \text{when } n > 1 \end{cases}$$

### Tree Method

![2022-12-09-14-05-14](/site-assets/2022-12-09-14-05-14.svg)

Each level does 1 unit of work across $k$ levels.

Assuming $\frac{n}{2^k}=1$, we get $n=2^k$, which simplifies to $k=\log_2(n)$.

Since there's one unit of work per level, the total work equals the number of levels: $O(\log n)$.

### Substitution Method

Starting with $T(n)=T(n/2)+1$, we substitute repeatedly:

$$T(n/2)=T(n/2^2) + 1$$
$$T(n)=[T(n/2^2)+1]+1 = T(n/2^2) + 2$$
$$T(n)=T(n/2^3) + 3$$

Generalizing to $k$ iterations: $T(n)=T(n/2^k)+k$

Assuming $\frac{n}{2^k}=1$, we get $n=2^k$ and $k=\log n$.

Substituting: $T(n)=T(1)+\log n = 1 + \log n$

Answer: $O(\log n)$

## Dividing Recurrence Relation 2

### Recurrence Relation

$$T(n) = \begin{cases} 1 & \text{when } n=1 \\\ T(n/2)+n & \text{when } n > 1 \end{cases}$$

### Tree Method

![ ](/site-assets/Screenshot_2022-12-11_at_11.52.59_PM_1670838851213_0.png)

Each level does $\frac{n}{2^k}$ amount of work.

So for each level, $n + \frac{n}{2} + \frac{n}{2^2} + \frac{n}{2^3} + ... + \frac{n}{2^k}$

$\displaystyle n \sum_{i=0}^k \frac{1}{2^i}$

This simplifies to n \* 1

so answer is $O(n)$

### Substitution Method

Starting with $T(n)=T(n/2)+n$:

$$T(n)=[T(n/2^2) + n/2] + n = T(n/2^2) + n/2 + n$$
$$T(n)=T(n/2^3) + n/2^2 + n/2 + n$$
$$T(n) = T(n/2^k) + n/2^{k-1} + \cdots + n/2 + n$$

Assuming $\frac{n}{2^k}=1$, we get $n=2^k$ and $k=\log n$.

$$T(n) = T(1) + n\left[\frac{1}{2^{k-1}} + \frac{1}{2^{k-2}} + \cdots + \frac{1}{2} + 1\right] = 1 + n \cdot 2 = 1 + 2n$$

Answer: $O(n)$

## Dividing Recurrence Relation 3

```js
function test(n) {
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      console.log(n);
    }
    test(n / 2);
    test(n / 2);
  }
}
```

The recurrence relation is $T(n)=2T(n/2) + n$

$$T(n) = \begin{cases} 1 & \text{when } n=1 \\\ 2T(n/2)+n & \text{when } n > 1 \end{cases}$$

### Tree Method

![2022-12-04-19-48-18](/site-assets/2022-12-04-19-48-18.svg)

Each row adds up to $n$ amount of work: the 2nd row has two $n/2$s, the 3rd row has four $n/4$s, and so on. Each row contributes $\frac{n}{2^k} \cdot 2^k = n$ work.

Assuming $\frac{n}{2^k}=1$, we get $n=2^k$ and $k=\log n$.

Since $n$ work is done across $\log n$ levels, the total work is $n \cdot \log n$.

### Substitution Method

Starting with $T(n)=2T(n/2)+n$, we substitute $T(n/2)=2T(n/2^2) + n/2$:

$$T(n) = 2[2T(n/2^2) + n/2] + n = 4T(n/2^2) + 2n$$

Continuing for $k$ iterations: $T(n)=2^k \cdot T(n/2^k) + kn$

Assuming $T(n/2^k)=T(1)$, we get $\frac{n}{2^k}=1$ and $k=\log n$.

## Master's Theorem for Dividing Functions

For recurrences of the form $T(n)=a \cdot T(n/b) + f(n)$ where $a \geq 1$, $b > 1$, and $f(n)=O(n^k \cdot \log^p n)$:

### Case 1: $\log_b(a) > k$

Then $T(n) = O(n^{\log_b(a)})$

### Case 2: $\log_b(a) = k$

- **Case 2.1:** If $p > -1$, then $T(n) = O(n^k \cdot \log^{p+1} n)$
- **Case 2.2:** If $p = -1$, then $T(n) = O(n^k \cdot \log(\log n))$
- **Case 2.3:** If $p < -1$, then $T(n) = O(n^k)$

### Case 3: $\log_b(a) < k$

- **Case 3.1:** If $p \geq 0$, then $T(n) = O(n^k \cdot \log^p n)$
- **Case 3.2:** If $p < 0$, then $T(n) = O(n^k)$

### Examples

#### Case 1

**Example 1:** $T(n) = 2T(n/2)+1$

Here $a=2$, $b=2$, and $f(n)=O(1)=O(n^0 \cdot \log(n)^0)$, so $k=0$ and $p=0$.

Since $\log_2(2)=1 > k=0$, this is case 1. Answer: $O(n)$

**Example 2:** $T(n)=4T(n/2)+n$

Here $\log_2(4)=2$, $k=1$, $p=0$. Since $\log_2(4)=2 > k=1$, this is case 1. Answer: $O(n^2)$

**Example 3:** $T(n)=8T(n/2)+n$

Here $\log_2(8)=3 > k=1$. Case 1, so $O(n^3)$

**Example 4:** $T(n)=8T(n/2)+n^2$

Here $\log_2(8)=3 > k=2$. Still case 1, so $O(n^3)$

**Example 5:** $T(n)=9T(n/3)+1$

Here $\log_3(9)=2 > k=0$. Case 1, so $O(n^2)$

#### Case 2

**Example 1:** $T(n)=2T(n/2)+n$

Here $\log_2(2)=1$ and $k=1$, so they're equal (case 2). Since $f(n)=n$ has no $\log(n)$ term, $p=0$. Answer: $O(n \log n)$

**Example 2:** $T(n)=4T(n/2)+n^2$

Here $\log_2(4)=2=k$, so case 2 with $p=0$. Answer: $O(n^2 \log n)$

**Example 3:** $T(n)=4T(n/2)+n^2 \log n$

Here $\log_2(4)=2=k$, so case 2 with $p=1$. Answer: $O(n^2 \log^2 n)$

**Example 4:** $T(n)=8T(n/2)+n^3$

Here $\log_2(8)=3=k$, so case 2 with $p=0$. Answer: $O(n^3 \log n)$

**Example 5:** $T(n)=2T(n/2)+\frac{n}{\log n}$

Note that $\frac{n}{\log n} = n \cdot \log(n)^{-1}$. Here $\log_2(2)=1=k$ and $p=-1$ (in denominator), so case 2.2. Answer: $O(n \log(\log n))$

**Example 6:** $T(n)=2T(n/2)+\frac{n}{\log^2 n}$

Here $\log_2(2)=1=k$ and $p=-2$ (in denominator), so case 2.3. Answer: $O(n)$

#### Case 3

**Example 1:** $T(n)=T(n/2) + n^2$

Here $\log_2(1)=0 < k=2$, so case 3.1. Answer: $O(n^2)$

**Example 2:** $T(n)=T(n/2) + n^2 \log n$

Here $\log_2(1)=0 < k=2$, so case 3.1 (take the entire $f(n)$). Answer: $O(n^2 \log n)$

**Example 3:** $T(n)=T(n/2) + \frac{n^3}{\log n}$

Here $\log_2(1)=0 < k=3$. Since log is in the denominator, this is case 3.2 (just take $n^k$). Answer: $O(n^3)$

## Master's Theorem Summary Tables

### Case 1: $\log_b(a) > k$

| Recurrence | Result |
|------------|--------|
| $T(n)=2T(n/2)+1$ | $O(n)$ |
| $T(n)=4T(n/2)+1$ | $O(n^2)$ |
| $T(n)=4T(n/2)+n$ | $O(n^2)$ |
| $T(n)=8T(n/2)+n^2$ | $O(n^3)$ |
| $T(n)=16T(n/2)+n^2$ | $O(n^4)$ |

### Case 2: $\log_b(a) = k$

| Recurrence | Result |
|------------|--------|
| $T(n)=T(n/2)+1$ | $O(\log n)$ |
| $T(n)=2T(n/2)+n$ | $O(n \log n)$ |
| $T(n)=2T(n/2)+n \log n$ | $O(n \log^2 n)$ |
| $T(n)=4T(n/2)+n^2$ | $O(n^2 \log n)$ |
| $T(n)=2T(n/2)+(n \log n)^2$ | $O(n^2 \log^3 n)$ |
| $T(n)=2T(n/2)+\frac{n}{\log n}$ | $O(n \log(\log n))$ |
| $T(n)=2T(n/2)+\frac{n}{\log^2 n}$ | $O(n)$ |

### Case 3: $\log_b(a) < k$

| Recurrence | Result |
|------------|--------|
| $T(n)=T(n/2)+n$ | $O(n)$ |
| $T(n)=2T(n/2)+n^2$ | $O(n^2)$ |
| $T(n)=2T(n/2)+n^2 \log n$ | $O(n^2 \log n)$ |
| $T(n)=4T(n/2)+n^3 \log^2 n$ | $O(n^3 \log^2 n)$ |
| $T(n)=2T(n/2)+\frac{n^2}{\log n}$ | $O(n^2)$ |

## Root Function (Recurrence Relation)

```js
function test(n){
  if(n>2) {
    stmt
    test(Math.sqrt(n))
  }
}
```

$$T(n) = \begin{cases} 1 & \text{when } n=2 \\\ T(\sqrt{n})+1 & \text{when } n > 2 \end{cases}$$

Expanding by substitution:

$$T(n)=T(n^{1/2})+1 = T(n^{1/4})+2 = T(n^{1/8})+3$$

Generalizing to $k$ iterations: $T(n)=T(n^{1/2^k})+k$

Let $n = 2^m$. Then $T(2^m)=T(2^{m/2^k}) + k$.

Assuming $T(2^{m/2^k})=T(2)$, we need $m/2^k=1$, so $m=2^k$ and $k=\log_2(m)$.

Since $n=2^m$, we have $m=\log_2(n)$, giving us $k=\log(\log n)$.

Answer: $O(\log(\log n))$
