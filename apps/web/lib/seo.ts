export function generateArticleJsonLd(work: any, url: string, coverImage: string) {
    return {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: work.title,
        description: work.description || "",
        image: coverImage ? [coverImage] : [],
        datePublished: work.createdAt?.toISOString(),
        dateModified: work.updatedAt?.toISOString(),
        author: [{
            "@type": "Person",
            "name": work.author || "Unknown"
        }],
        publisher: {
            "@type": "Organization",
            "name": "StoryReview",
            "logo": {
                "@type": "ImageObject",
                "url": typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/logo.png` : "https://storyreview.com/logo.png"
            }
        },
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": url
        }
    };
}

export function generateBreadcrumbJsonLd(items: { name: string, url: string }[]) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "item": item.url
        }))
    };
}
