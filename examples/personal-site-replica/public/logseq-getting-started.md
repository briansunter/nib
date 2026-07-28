<!-- generated-markdown-alternate -->
---
title: "Logseq Getting Started"
description: "How to get started with Logseq and publish your notes online in 30 minutes."
url: "https://briansunter.com/logseq-getting-started"
---

OCT 3, 2022 · 4 MIN READ

# Logseq Getting Started

How to get started with Logseq and publish your notes online in 30 minutes.

![Cover image for Logseq Getting Started](/_astro/image_1662087082755_0.BCcfoMhk_tolUk.webp)

[Logseq](https://logseq.com/) is a free open source notetaking tool that makes it easy to share your notes online. I’ll show you how to get set up quickly.

Here’s what we’ll cover:

1. Download Logseq
2. Start taking notes in your daily notes
3. Create pages using backlinks (surrounded with double square brackets like `[[backlink]]`)
4. Make a few pages public
5. Share your pages with the world

I’ll use [Netlify](https://netlify.com/) as the hosting example because it’s free and easy to get started. Logseq generates a site that works with many hosting providers, so you can switch later if you want. I recommend getting something basic online first, then exploring other options.

## Download Logseq

Download Logseq from the [releases page on GitHub](https://github.com/logseq/logseq/releases).

Find the release tagged “Latest” (not “Pre-release”) and pick the right version for your system: darwin-arm for M1/M2 Mac, darwin-x64 for Intel Mac, or the Windows version.

![image](/_astro/image_1662087068660_0.BDQB3eyr_Wk8vh.webp)

image

## Set up Logseq

After installing and opening Logseq, you’ll see this page:

![image](/_astro/image_1662087082755_0.BCcfoMhk_201nK.webp)

image

Create a folder called `Logseq` in iCloud Drive, then make a subfolder for your graph (something like `notes`). Using iCloud Drive means your notes will sync to the mobile app.

![image](/_astro/image_1662087093541_0.BOk82s8k_Z1aJpSV.webp)

image

## Start writing in daily notes

You’ll see an empty page with today’s date. This is your “daily notes” page. It’s usually my starting place for ideas. I type some thoughts and create `[[backlinks]]` for important concepts so I can find my notes later when writing or researching.

Spend some time experimenting: write some notes, make backlinks, click the backlinks to see how pages connect.

![Conor's avatar](https://pbs.twimg.com/profile_images/1327975905780670464/gbBmU0Gf_normal.jpg)

[Conor](https://twitter.com/Conaw/status/1315078546763603968)

@Conaw

[@activatelearn](https://twitter.com/activatelearn) [@rosiesherry](https://twitter.com/rosiesherry) [@RoamResearch](https://twitter.com/RoamResearch) You don't need to learn anything besides writing a few words you think are important in \[\[these brackets]], and hitting tab. The rest is just folks getting excited and building on that foundation. Very easy gateway, and many very capable people never feel need to go beyond.

[Oct 10, 2020, 1:55 PM](https://twitter.com/Conaw/status/1315078546763603968)

***

426

31

## Make your public homepage

Now let’s create a home for you on the internet.

Create a homepage by typing `[[homepage]]` then clicking on it. This creates the page and navigates you to it.

Write some text about yourself and your interests.

Make it public by clicking the three dots in the upper right corner and selecting “Make it public for publishing.”

![image](/_astro/image_1662087105153_0.FHKciR-s_rRbe9.webp)

image

Only the pages you mark as public will be published. You can keep most of your graph private with just a few pages visible to the world. Remember to select this option on each page you want to publish.

## Export your public graph

### Set your homepage

Logseq has a concept of a “home page” that loads when you open the app.

For private notetaking, I like my daily notes as the default. For my published site, I want the dedicated homepage we just created.

To change this, we need to update the `:default-home` setting before exporting.

Click the three dots in the upper right corner, then select Settings. Choose “Edit config.edn.”

![image](/_astro/image_1662087114284_0.DQI3pxJc_1Nhhke.webp)

image

Add a line to set your homepage:

![image](/_astro/image_1662087124359_0.CBaZRiWC_JntvJ.webp)

image

This is a bit inconvenient to do each time you publish, but the overall experience is pretty good. I expect these publishing features will improve over time.

When you’re ready to publish, click the three dots in the upper right corner, select “Export graph,” then “Export public pages.”

![image](/_astro/image_1662087133034_0.BS5qRzwc_Z8lLbm.webp)

image

Pick a memorable folder for the output.

After exporting, comment out the default-home line with two semicolons `;;` so your private journal goes back to using daily notes as the default page.

![image](/_astro/image_1662087142333_0.B4IUkX6j_ZJOO3L.webp)

image

## Publish your public graph online

There are many good options, but I recommend Netlify because it’s free and simple. You can always switch later.

[Sign up for Netlify here.](https://app.netlify.com/signup)

After signing in, go to [Netlify Drop](https://app.netlify.com/drop).

![image](/_astro/image_1662087153089_0.Bg9v6e_Z_LKsav.webp)

image

Click the folder icon and select the folder where you exported your public graph.

In a few minutes you should be online!

To update your site later, export your public graph again, then click the “Deploys” tab and upload the new version.

![image](/_astro/image_1662087164166_0.Clj03C5T_Z2pakeN.webp)

image

## Next steps

### Set up a custom domain

I strongly recommend getting a custom domain like yourname.com.

You want the links you share to work forever. If you own your domain, you can switch away from Netlify later. If all your links have netlify.app in the URL, you’re stuck.

The easiest approach is buying through Netlify. They set everything up so the domain points to your site automatically. It costs about $12/year. You can transfer the domain elsewhere later, or connect a domain you already own.

![image](/_astro/image_1662087175738_0.BYufkx-t_Z1jpwWM.webp)

image

![image](/_astro/image_1662087184888_0.DtlW9Ch0_KA8Pl.webp)

image

## Conclusion

There are many ways to host your public graph, but uploading to Netlify Drop is the easiest for non-technical users.

Don’t get paralyzed by options. Get your site up now on Netlify, then figure out the perfect solution later. You can always migrate providers if you own the domain.

[Let me know on Twitter if you found this guide useful](https://twitter.com/Bsunter), especially if you set up your own public graph!

## Subscribe to newsletter

I send occasional emails about new blog posts, side projects, and things I'm learning.

By subscribing, you agree to our [Privacy Policy](/privacy).

[Older Werner Herzog's Rules for Filmmaking ](/werner-herzog-rules-for-filmmaking)[Newer Intro to Algorithms](/intro-to-algorithms)

## Related

- [Notetaking with NLP and AI Aug 20, 2022](/notetaking-with-ai)
- [Logseq GPT-3 OpenAI Popup Jan 30, 2023](/logseq-openai/popup)
- [Omnivore Logseq Guide Oct 25, 2022](/omnivore-logseq-guide)

## Share this article
