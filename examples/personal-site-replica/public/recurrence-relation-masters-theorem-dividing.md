<!-- generated-markdown-alternate -->
---
title: "Recurrence Relation and Master's Theorem for Dividing Functions"
description: "How to use the Master's Theorem to figure out the time complexity of divide-and-conquer algorithms like merge sort."
url: "https://briansunter.com/recurrence-relation-masters-theorem-dividing"
---

JAN 4, 2023 · 7 MIN READ

# Recurrence Relation and Master's Theorem for Dividing Functions

How to use the Master's Theorem to figure out the time complexity of divide-and-conquer algorithms like merge sort.

![Cover image for Recurrence Relation and Master's Theorem for Dividing Functions](/_astro/recurrence-masters-theorem-cover.CRRmNQ0R_28G0QI.webp)

## Dividing Recurrence Relation 1

js

```
function test(n) {
  if (n > 1) {
    console.log(n);
    test(n / 2);
  }
}
```

When a function takes a parameter n, it can make it smaller by either subtracting like or dividing like or .

Amount of work is

### Recurrence Relation Dividing

### Tree Method

![2022-12-09-14-05-14](/_astro/2022-12-09-14-05-14.BE5GVghK_Z2on0S7.svg)

2022-12-09-14-05-14

Each level does 1 unit of work across levels.

Assuming , we get , which simplifies to .

Since there’s one unit of work per level, the total work equals the number of levels: .

### Substitution Method

Starting with , we substitute repeatedly:

Generalizing to iterations:

Assuming , we get and .

Substituting:

Answer:

## Dividing Recurrence Relation 2

### Recurrence Relation

### Tree Method

![Screenshot 2022-12-11 at 11.52.59 PM](/_astro/Screenshot_2022-12-11_at_11.52.59_PM_1670838851213_0.doFy-2My_ZcILIw.webp)

Screenshot 2022-12-11 at 11.52.59 PM

Each level does amount of work.

So for each level,

This simplifies to n \* 1

so answer is

### Substitution Method

Starting with :

Assuming , we get and .

Answer:

## Dividing Recurrence Relation 3

js

```
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

The recurrence relation is

### Tree Method

![2022-12-04-19-48-18](/_astro/2022-12-04-19-48-18.B_OzntvO_ZuISbM.svg)

2022-12-04-19-48-18

Each row adds up to amount of work: the 2nd row has two s, the 3rd row has four s, and so on. Each row contributes work.

Assuming , we get and .

Since work is done across levels, the total work is .

### Substitution Method

Starting with , we substitute :

Continuing for iterations:

Assuming , we get and .

## Master’s Theorem for Dividing Functions

For recurrences of the form where , , and :

### Case 1:

Then

### Case 2:

- **Case 2.1:** If , then
- **Case 2.2:** If , then
- **Case 2.3:** If , then

### Case 3:

- **Case 3.1:** If , then
- **Case 3.2:** If , then

### Examples

#### Case 1

**Example 1:**

Here , , and , so and .

Since , this is case 1. Answer:

**Example 2:**

Here , , . Since , this is case 1. Answer:

**Example 3:**

Here . Case 1, so

**Example 4:**

Here . Still case 1, so

**Example 5:**

Here . Case 1, so

#### Case 2

**Example 1:**

Here and , so they’re equal (case 2). Since has no term, . Answer:

**Example 2:**

Here , so case 2 with . Answer:

**Example 3:**

Here , so case 2 with . Answer:

**Example 4:**

Here , so case 2 with . Answer:

**Example 5:**

Note that . Here and (in denominator), so case 2.2. Answer:

**Example 6:**

Here and (in denominator), so case 2.3. Answer:

#### Case 3

**Example 1:**

Here , so case 3.1. Answer:

**Example 2:**

Here , so case 3.1 (take the entire ). Answer:

**Example 3:**

Here . Since log is in the denominator, this is case 3.2 (just take ). Answer:

## Master’s Theorem Summary Tables

### Case 1:

| Recurrence | Result |
| ---------- | ------ |
|            |        |
|            |        |
|            |        |
|            |        |
|            |        |

### Case 2:

| Recurrence | Result |
| ---------- | ------ |
|            |        |
|            |        |
|            |        |
|            |        |
|            |        |
|            |        |
|            |        |

### Case 3:

| Recurrence | Result |
| ---------- | ------ |
|            |        |
|            |        |
|            |        |
|            |        |
|            |        |

## Root Function (Recurrence Relation)

js

```
function test(n){
  if(n>2) {
    stmt
    test(Math.sqrt(n))
  }
}
```

Expanding by substitution:

Generalizing to iterations:

Let . Then .

Assuming , we need , so and .

Since , we have , giving us .

Answer:

## Subscribe to newsletter

I send occasional emails about new blog posts, side projects, and things I'm learning.

By subscribing, you agree to our [Privacy Policy](/privacy).

[Older Recurrence Relation and Master's Theorem for Subtracting Functions ](/recurrence-relation-masters-theorem-subtracting)[Newer Heap, Heap Sort, Heapify, and Priority Queues](/heap)

## Related

- [Recurrence Relation and Master's Theorem for Subtracting Functions Jan 4, 2023](/recurrence-relation-masters-theorem-subtracting)
- [Algorithms and Data Structures Oct 3, 2022](/algorithms)
- [Time Complexity Analysis Aug 21, 2022](/time-complexity)

## Share this article
