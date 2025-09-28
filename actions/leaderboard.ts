"use server";

import { getApplicantDataBySlugs } from "./history";

// --- Helper to add a delay ---
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest(endpoint: string, apiKey: string) {
  const response = await fetch(`https://api.cr4ce.com${endpoint}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      Accept: "application/vnd.Creative Force.v2.3+json",
      "x-api-language": "en_GB",
    },
  });

  if (!response.ok) {
    // Basic retry for 429 error
    if (response.status === 429) {
      console.warn("Rate limited. Retrying after 1 second...");
      await sleep(1000);
      return apiRequest(endpoint, apiKey);
    }
    const errorData = await response.text();
    console.error(`API Error: ${response.status} - ${errorData}`);
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

async function getApplicationDetails(config: { apiKey: string }, slug: string) {
  return apiRequest(`/application/${slug}`, config.apiKey);
}

export async function getScoreSets(config: {
  apiKey: string;
}): Promise<{ slug: string; name: { en_GB: string } }[]> {
  const response = await apiRequest(`/score-set`, config.apiKey);
  return response.data;
}

const calculateTotalScore = (entry: any): number => {
  if (entry.scores?.criteria?.length > 0) {
    return entry.scores.criteria.reduce(
      (sum: number, criterion: any) => sum + (Number(criterion.value) || 0),
      0
    );
  }
  return entry.auto_score || 0;
};

const enrichData = async (entries: any[], config: { apiKey: string }) => {
  const slugs = entries.map((entry: any) => entry?.slug).filter(Boolean);
  if (slugs.length === 0) return [];

  const applicantDataMap = await getApplicantDataBySlugs(slugs);
  const missingSlugs = slugs.filter((slug) => !applicantDataMap.has(slug));

  // --- FIX: Process fallback requests sequentially to avoid rate limiting ---
  if (missingSlugs.length > 0) {
    for (const slug of missingSlugs) {
      try {
        const detail = await getApplicationDetails(config, slug);
        if (detail && detail.slug) {
         

          const municipalityField = detail.application_fields?.find(
            (f: any) => f.slug === "rDkKljjz" 
          );
         
          
          const municipality = municipalityField?.value || "N/A";

          applicantDataMap.set(detail.slug, {
            name: detail.applicant.name,
            municipality: municipality,
          });
        }
        // Add a small delay between each request to respect API rate limits
        await sleep(200);
      } catch (error) {
        console.error(
          `Failed to fetch fallback details for slug ${slug}:`,
          error
        );
      }
    }
  }

  return entries.map((entry: any) => {
    const slug = entry?.slug;
    const applicantInfo = applicantDataMap.get(slug);

    return {
      slug: entry.slug,
      tags: entry.tags
        ? entry.tags.split(",").map((t: string) => t.trim())
        : [],
      title: entry.title || "Untitled Application",
      applicantName: applicantInfo?.name || entry.applicant?.name || "N/A",
      municipality: applicantInfo?.municipality || "N/A",
      totalScore: calculateTotalScore(entry),
      scoreBreakdown:
        entry.scores?.criteria?.map((c: any) => ({
          name: c.name?.en_GB || "Unnamed Criterion",
          score: c.final_score || `${c.value || 0}`,
        })) || [],
    };
  });
};

export async function getLeaderboardData(
  config: { apiKey: string },
  scoreSetSlug: string,
  page: number,
  perPage: number,
  titleSearch?: string,
  sort?: { key: string; direction: "asc" | "desc" }
) {
  if (!scoreSetSlug) {
    return { data: [], current_page: 1, last_page: 1, total: 0 };
  }

  if (titleSearch) {
    let allEntries: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const query = new URLSearchParams({
        score_set: scoreSetSlug,
        per_page: "100",
        page: currentPage.toString(),
      }).toString();

      const response = await apiRequest(`/leaderboard?${query}`, config.apiKey);
      allEntries = allEntries.concat(response.data);

      if (!response.next_page_url) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    const filteredEntries = allEntries.filter((entry) =>
      entry.title?.toLowerCase().includes(titleSearch.toLowerCase())
    );

    const enrichedEntries = await enrichData(filteredEntries, config);
    enrichedEntries.sort((a, b) => b.totalScore - a.totalScore);

    const total = enrichedEntries.length;
    const lastPage = Math.ceil(total / perPage);
    const paginatedData = enrichedEntries.slice(
      (page - 1) * perPage,
      page * perPage
    );

    return {
      data: paginatedData,
      current_page: page,
      last_page: lastPage,
      total: total,
    };
  }

  const query = new URLSearchParams({
    score_set: scoreSetSlug,
    per_page: perPage.toString(),
    page: page.toString(),
  });

  if (sort && (sort.key === "auto_score" || sort.key === "title")) {
    query.append("order", sort.key);
    query.append("dir", sort.direction);
  } else {
    query.append("order", "auto_score");
    query.append("dir", "desc");
  }

  const response = await apiRequest(
    `/leaderboard?${query.toString()}`,
    config.apiKey
  );
  const enrichedPageData = await enrichData(response.data, config);

  return {
    data: enrichedPageData,
    current_page: response.current_page,
    last_page: response.last_page,
    total: response.total,
  };
}
