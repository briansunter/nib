---
title: "Analyzing Coffee with Data Science + ChatGPT Code Interpreter"
description: "Uploading a dataset about coffee and using ChatGPT to automatically clean the data, understand insights, and generate cool charts."
date: 2023-07-27T00:00:00.000Z
cover: "/site-assets/coffee_quality_by_country_boxplot.png"
wordCount: 1752
tags:
  - "newsletter"
  - "logseq"
  - "gpt"
  - "AI"
layout: article
---
One of my favorite new features of [ChatGPT](https://chat.openai.com/) is the "[code interpreter](https://openai.com/blog/chatgpt-plugins#code-interpreter)," which allows ChatGPT to execute code and read data files you upload.

You can upload a data file, then ask ChatGPT questions, and ChatGPT will write code to analyze the data and create visualizations based on your questions. You get charts out of data with very little effort.

What's interesting is that ChatGPT will look at the structure of your data, automatically clean it, and decide how to analyze it.

I found an interesting dataset on Kaggle called ["Coffee Quality Data"](https://www.kaggle.com/datasets/fatihb/coffee-quality-data-cqi). It contains coffee reviews from the Coffee Quality Institute (CQI), with 100-point scores, along with information about the coffee, such as its country of origin, altitude, preparation method, and variety, and information about its flavor profile, such as acidity and sweetness.

I'm interested in examining this dataset to answer questions like: "Which countries produce the best coffee?" and "What are the differences in flavor profiles between countries and preparation methods?"

### Loading and Cleaning Data

One of my favorite features of the ChatGPT code interpreter is its ability to clean data and do a preliminary analysis quickly.

The coffee dataset is of decent quality but has some issues, like missing data, poorly formatted altitude values, and varied processing method names. This is usually a manual, laborious process and is inconvenient for quick exploratory analysis. The ChatGPT code interpreter automatically detects the important columns and cleans up common problems without being asked.

It starts by loading the dataset and printing it to discover the most important columns of data.

#### Load, print, and preliminary analysis

```python
## First, let's load and inspect the dataset
import pandas as pd

## Load the data
df = pd.read_csv('/mnt/data/df_arabica_clean.csv')

## Display the first few rows of the dataframe
df.head()
```

> The dataset contains 41 columns and 207 coffee samples. Here are a few key ones:
>
> - **Country of Origin**: The country where the coffee bean was grown.
> - **Farm Name**: The name of the coffee farm.
> - **Altitude**: The altitude at which the coffee was grown.
> - **Region**: The region where the coffee was grown.
> - **Processing Method**: The method used to process the coffee beans.
> - **Variety**: The coffee variety (e.g., Gesha, Typica, Bourbon).
> - **Aroma, Flavor, Aftertaste, Acidity, Body, Balance, Uniformity, Clean Cup, Sweetness, Overall**: Scores given to the coffee on various attributes by professional cuppers.
> - **Total Cup Points**: The overall quality score (our target variable).

> Our target variable is `Total Cup Points` as we are trying to find out what makes the best coffee. The higher the total cup points, the better the coffee is considered to be.

> For our analysis, we'll mainly focus on the factors that might affect coffee quality, such as Country of Origin, Variety, Processing Method, Altitude, and sensory profiles (Aroma, Flavor, Aftertaste, Acidity, Body, Balance).

#### Missing Values

It checks for missing values and decides how to handle them.

```python
## Descriptive statistics
desc_stats = df.describe(include='all')

## Checking for missing values
missing_values = df.isnull().sum()

desc_stats, missing_values
```

> The dataset has minimal missing values:
>
> - Variety: 6 missing values
> - Processing Method: 5 missing values
> - Altitude: 1 missing value

For this relatively clean dataset, rows with missing values in key analysis columns can be excluded when analyzing those specific features.

### Analyzing Data

It starts with a quick analysis to show the distribution of the most important data points.

#### Distribution of Ratings

> The histogram shows the distribution of the total cup points, representing the coffee's overall quality. The distribution is approximately normal with scores ranging from 78 to 89 points. The mean score is 83.7, indicating that most coffees in this dataset are of good specialty-grade quality.

![ ](/site-assets/coffee_distribution.png)

#### Initial Analysis

Next, ChatGPT does a more detailed analysis by automatically graphing what it thinks are the most important pieces of data.

> Let's examine the relationships between coffee quality (`Total Cup Points`) and some potentially influential factors (`Country of Origin`, `Variety`, `Processing Method`, `Altitude`, and sensory profiles). We will use box plots and bar charts to visualize these relationships.

> The visualizations suggest that:
>
> - The highest average coffee quality comes from Ethiopia, Tanzania, Taiwan, and Guatemala.
> - The Gesha variety and SL34 are associated with superior coffee quality.
> - Washed/Wet processing is the most common method, while Natural/Dry shows slightly higher median quality.
> - Higher altitudes (1600m+) tend to produce slightly higher quality coffee.
> - Flavor and Aftertaste scores have a strong positive correlation with overall coffee quality.

### Loading Data and Removing Outliers

The graph above was generated by this code, written by ChatGPT:

The first part loads the data and handles altitude parsing:

```python
import pandas as pd
import numpy as np

df = pd.read_csv('/mnt/data/df_arabica_clean.csv')

## Parse altitude - extract numeric values from ranges like "1700-1930"
def parse_altitude(alt):
    if pd.isna(alt):
        return np.nan
    alt_str = str(alt)
    if '-' in alt_str:
        parts = alt_str.split('-')
        try:
            return (float(parts[0]) + float(parts[1])) / 2
        except:
            pass
    try:
        return float(alt_str.replace(',', '').replace('m', '').strip())
    except:
        return np.nan

df['Altitude_Numeric'] = df['Altitude'].apply(parse_altitude)

## Calculate the mean Total Cup Points for each category and sort in descending order
top_countries_mean = df.groupby('Country of Origin')['Total Cup Points'].mean().sort_values(ascending=False).index[:10]
top_varieties_mean = df.groupby('Variety')['Total Cup Points'].mean().sort_values(ascending=False).index[:8]

## Get processing method means
df_method_mean = df.groupby('Processing Method')['Total Cup Points'].mean().sort_values(ascending=False)
```

### Generating Charts with Matplotlib and seaborn

The second part of the code generates the charts:

```python
import matplotlib.pyplot as plt
import seaborn as sns

## Set up the figure size
plt.figure(figsize=(12, 8))

## Box plot for Country of Origin
sns.boxplot(data=df[df['Country of Origin'].isin(top_countries_mean)],
            y='Country of Origin', x='Total Cup Points',
            order=top_countries_mean)
plt.title('Coffee Quality by Country of Origin')
plt.xlim(78, 90)
plt.tight_layout()
plt.show()
```

### Visualizations

I continued asking it questions to generate visualizations, such as "Generate a bar chart for top mean cup scores by country, sorted in descending order."

Here are some of my favorite visualizations:

### Coffee Quality by Country

![ ](/site-assets/coffee_quality_by_country_bar.png)

![ ](/site-assets/coffee_quality_by_country_boxplot.png)

- **Ethiopia** has the highest average quality score (84.96). If you've had Ethiopian coffee, you know the fruity and floral notes.
- **Tanzania** is close behind (84.74), with bright, complex cups.
- **Taiwan** scored well (84.35) across a big sample (61 coffees). I didn't expect Taiwan to show up this high.
- **Guatemala** (84.30) is consistent, with good acidity.

### Coffee Quality by Variety

![ ](/site-assets/coffee_quality_by_variety_bar.png)

![ ](/site-assets/coffee_quality_by_variety_boxplot.png)

The variety rankings:
- **Gesha** (also spelled Geisha) has the highest average score (85.43). It's the expensive one for a reason: jasmine and bergamot notes.
- **SL34** scored 84.94. It's a Kenyan variety with complex fruit flavors.
- **Ethiopian Heirlooms** scored 84.70, though this bucket covers a lot of different indigenous varieties.
- **Typica** and **Bourbon** are solid and consistent.

### Coffee Quality by Altitude Range

Higher altitudes generally produce better coffee. The cherries develop more slowly at altitude, which seems to produce more complex flavors.

![ ](/site-assets/coffee_quality_by_altitude.png)

- Coffee grown at **1800m+** has the highest median quality
- There's a general trend of increasing quality with altitude
- The effect isn't dramatic, but it's there across the dataset

### Quality by Processing Method

What are processing methods? These are how the beans are dried and prepared before roasting.

**Washed / Wet**: Beans are de-pulped, fermented, and thoroughly washed of all mucilage. This method typically yields coffee with more pronounced acidity and cleaner flavors due to removing all fruit before drying.

**Natural / Dry**: The cherries are picked and spread out in the sun to dry, allowing the fruit to ferment before the seed is removed naturally. The coffee retains intense, fruity flavors from the cherry.

**Honey / Pulped Natural**: This technique involves removing the skin of the coffee cherries but leaving some of the fruity pulp on the seeds when drying. The name 'honey' refers to the sticky texture as it dries, not the taste.

**Anaerobic**: A newer experimental method where beans ferment in oxygen-free environments, creating unique and often intense flavor profiles.

![ ](/site-assets/coffee_quality_by_processing.png)

By the numbers:
- **Natural/Dry** processing has the highest median quality (84.0) among the common methods
- **Washed/Wet** is the most common method (124 samples) with consistent quality
- **Honey/Pulped Natural** sits between washed and natural: some clarity, some fruitiness
- **Anaerobic** is interesting but there's barely any data (n=1-2), so I wouldn't read too much into it

### Flavor Profile by Country

How different countries compare on different flavor profiles, such as sweetness and acidity.

This uses an interesting chart called a "Radar Chart" to visualize multiple sensory dimensions simultaneously.

![ ](/site-assets/coffee_radar_top4.png)

- **Ethiopian** coffees are highest in Acidity (8.02) and Flavor (7.87)
- **Tanzanian** coffees have the highest Aroma scores (7.90)
- **Taiwanese** coffees are pretty balanced across all attributes
- **Guatemalan** coffees have strong Flavor scores (7.88)

### Sensory Attribute Correlations

Which sensory attributes matter most for the overall quality score:

![ ](/site-assets/coffee_correlation.png)

- **Overall** rating correlates most strongly (0.95) with Total Cup Points, then **Flavor** (0.94)
- **Aftertaste** and **Balance** are close behind (0.93)
- **Aroma** has a strong influence too (0.87)
- **Uniformity**, **Clean Cup**, and **Sweetness** are near-perfect for most samples, so they don't tell you much about quality differences

## Conclusion

I've been using the ChatGPT code interpreter a lot for exploratory data analysis, and it's been useful.

The result that surprised me most was Taiwan. I don't think of it as a major coffee origin, but it scored 84.35 across 61 samples, which is a real signal, not noise. The correlation data was less surprising: Flavor and Aftertaste drive the overall score, while Uniformity and Sweetness are basically table stakes at the specialty level.

ChatGPT handled almost all the data cleaning and chart code automatically. I just uploaded the CSV and asked questions.

The main limitation right now is that the Code Interpreter only has a handful of preinstalled libraries. Once it can install and run anything, this gets a lot more powerful.
