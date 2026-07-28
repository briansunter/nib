---
title: "Intro to Algorithms"
description: "What algorithms are, why they matter, and how to start thinking about problem solving."
date: 2022-10-04T00:00:00.000Z
cover: "/site-assets/image_1662087569135_0.png"
wordCount: 957
tags:
  - "algorithms"
  - "programming"
layout: article
---
## What is an algorithm?

An algorithm is a **sequence of steps to solve a problem**.

That's it. Nothing fancy. In computer science, we write these steps in code so a computer can follow them. Once we've written the algorithm, the computer runs it and solves the problem for us.

Say we want to sort a list of numbers. We write an algorithm to do the sorting, and the computer turns `[5, 2, 3, 4, 1]` into `[1, 2, 3, 4, 5]`.

Algorithms go hand in hand with "data structures," which is how we organize data in memory. An array, for example, stores items in a specific order so we can access them by position.

## Real world algorithms

Algorithms aren't just a computer science thing. They're everywhere.

### Recipes are algorithms

A recipe is just an algorithm for cooking. It's a list of steps that anyone can follow to make the same dish.

*Image credit: [seuraa](https://www.behance.net/gallery/95101957/Desserts-recipes-in-infographics?locale=fi_FI)*

### Cookware as data structures

![person cooking on stainless steel cooking pot](https://images.unsplash.com/photo-1584990347955-2ec0431a6e8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwyNDYwNDl8MHwxfHNlYXJjaHw4fHxjb29rd2FyZXxlbnwwfHx8fDE2NTc5Mjc5MTQ&ixlib=rb-1.2.1&q=80&w=400)

Data structures store and organize the data an algorithm needs. In cooking, that's your cookware: pans, bowls, the stovetop itself. You use them to hold and access ingredients as you work through the recipe.

## Algorithms vs heuristics

A heuristic is like an algorithm's looser cousin. It gives you a general approach but doesn't guarantee the exact same result every time.

The "no-recipe recipe" trend is a good example. Instead of exact measurements and times, you get a rough outline: "some garlic, a splash of oil, roast until crispy." The outcome varies based on your interpretation.

### No-recipe recipe example

Here's a bulgogi-style tofu recipe that reads more like a heuristic than an algorithm:

![ ](/site-assets/image_1662087583121_0.png)

> Press some firm tofu to extract as much liquid as you can. Make a marinade of soy sauce, brown sugar, sesame oil, minced garlic, grated ginger, a spoonful of gochujang, a splash of neutral oil, some sliced scallions and toasted sesame seeds. Slice the tofu into bite-size cubes, and slide them into the marinade. Let that sit. A half-hour works; a few hours works better. Then roast them in a hot oven on an oiled foil-lined pan until they're crisp.

No exact amounts. No specific temperatures. The result depends on how you fill in the blanks.

## Algorithm efficiency

Different algorithms can solve the same problem, but some are faster than others. A big part of programming is picking the right approach.

### Mise en place

![ ](/site-assets/image_1662087595225_0.png)

*Image credit: [Michael A. Gisondi](https://icenetblog.royalcollege.ca/about/about-the-editors/) ([@MikeGisondi](https://twitter.com/MikeGisondi))*

"Mise en place" is a French cooking term for preparing everything before you start. You chop your vegetables, measure your spices, and set out your tools. The actual cooking goes faster because you're not scrambling mid-recipe.

**5 steps of mise en place:**

1. Know your recipe: ingredients, cookware, temperatures, cook times
2. Prepare your ingredients: clean, debone, chop, mince
3. Arrange your ingredients: appropriate size bowls, positioned logically
4. Prepare your workstation: set the oven temperature, clean the area
5. Arrange your tools: prepare cookware and necessary equipment

The same principle applies to algorithms. Organizing your data ahead of time makes the actual computation faster.

**Algorithm mise en place:**

1. Know your algorithms: use case, possible approaches, tradeoffs
2. Prepare your data: understand input format, validate, convert
3. Arrange your data: use appropriate data structures
4. Prepare your workstation: set up project, repo, editor, IDE
5. Arrange your tools: set up test runners and other utilities

## Sorting: a concrete example

Sorting is one of the most common algorithm categories. Given a list like `[5, 3, 1, 4, 2]`, a sorting algorithm rearranges it into `[1, 2, 3, 4, 5]`.

There are many sorting algorithms (bubble sort, merge sort, quicksort) and they differ significantly in speed. Bubble sort is easy to understand but slow. Quicksort is more complex but much faster for large lists.

### How bubble sort works

Bubble sort repeatedly compares adjacent elements and swaps them if they're in the wrong order. It keeps passing through the list until everything is sorted.

It's called "bubble sort" because larger values gradually "bubble up" to the end of the list.

### Diagram

![ ](/site-assets/image_1662087609939_0.png)

*Diagram credit: [ProductPlan](https://www.productplan.com/glossary/bubble-sort/)*

### Code

```typescript
/**
 * Bubble Sort is a simple sorting algorithm that works by repeatedly
 * swapping adjacent elements if they are in the wrong order.
 * This implementation is in-place but not efficient.
 * @param input - The array to be sorted
 * @returns The sorted array
 */
function bubbleSort(input: number[]): number[] {
  // for every element in the array
  for (let i = 0; i < input.length; i++) {
    // compare the current element with the next element
    for (let j = 0; j < input.length; j++) {
      // if the current element is greater than the next element
      if (input[j] > input[j + 1]) {
        // swap the two elements
        const temp = input[j];
        input[j] = input[j + 1];
        input[j + 1] = temp;
      }
    }
  }
  return input;
}

export { bubbleSort };
export default bubbleSort;
```

In practice, you'd use a faster algorithm like quicksort or mergesort. Bubble sort is mostly useful for learning.

## Wrapping up

- **Algorithms** are step-by-step instructions for solving problems
- **Heuristics** are less precise approaches that don't guarantee exact results
- **Data structures** organize the data your algorithms work with
- **Efficiency matters**: different algorithms can produce the same result at very different speeds

For a deeper dive into measuring algorithm speed, check out my notes on [[time-complexity|time complexity]].
