"use server";

const API_BASE_URL = "https://api.cr4ce.com";
const API_VERSION_HEADER = "application/vnd.Creative Force.v2.3+json";
const SEASON_SLUG = "VgbzlaOa";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeFetch(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 1000
): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (res.status === 429 && retries > 0) {
      console.warn(`Rate limited. Retrying in ${delay}ms...`);
      await sleep(delay);
      return safeFetch(url, options, retries - 1, delay * 2);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Request failed. Retrying in ${delay}ms...`, err);
      await sleep(delay);
      return safeFetch(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

async function apiRequest(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  apiKey: string,
  body?: any
) {
  const options: RequestInit = {
    method,
    headers: {
      "x-api-key": apiKey,
      Accept: API_VERSION_HEADER,
      "x-api-language": "en_GB",
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await safeFetch(`${API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`API Error: ${response.status} - ${errorData}`);
    throw new Error(`API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

// --- Types ---
export interface FetchParams {
  page: number;
  per_page: number;
  order: string;
  dir: "asc" | "desc";
  archived: "only" | "none";
  deleted: "only" | "none";
}

interface Filters {
  title?: string;
  tags?: string[];
  status?: string;
  date_after?: string | null; // Allow null as well
  date_before?: string;
}

// --- API Actions ---
export async function getApplications(
  config: { apiKey: string },
  params: FetchParams,
  filters: Filters
) {
  const query = new URLSearchParams({
    page: params.page.toString(),
    per_page: params.per_page.toString(),
    order: params.order,
    dir: params.dir,
    archived: params.archived,
    deleted: params.deleted,
  });

  if (filters.title) query.append("title", filters.title);
  if (filters.status) query.append("status", filters.status);

  // --- CORRECTED DATE FORMATTING ---
  if (filters.date_after) {
    // Convert to Date object, format to ISO string, then remove milliseconds
    const formattedDate =
      new Date(filters.date_after).toISOString().split(".")[0] + "Z";
    query.append("updated_at[after]", formattedDate);
  }
  if (filters.date_before) {
    // Also apply the fix to the 'date_before' filter for consistency
    const formattedDate =
      new Date(filters.date_before).toISOString().split(".")[0] + "Z";
    query.append("updated_at[before]", formattedDate);
  }
  // --- END OF CORRECTION ---

  if (Array.isArray(filters.tags)) {
    filters.tags.forEach((tag) => query.append("tag", tag));
  }

  return apiRequest(`/application?${query.toString()}`, "GET", config.apiKey);
}

export async function getApplicationDetails(
  config: { apiKey: string },
  slug: string
) {
  return apiRequest(`/application/${slug}`, "GET", config.apiKey);
}

export async function archiveApplication(
  config: { apiKey: string },
  slug: string
) {
  return apiRequest(`/application/${slug}/archive`, "PUT", config.apiKey);
}

export async function unarchiveApplication(
  config: { apiKey: string },
  slug: string
) {
  return apiRequest(`/application/${slug}/archive`, "DELETE", config.apiKey);
}

export async function deleteApplication(
  config: { apiKey: string },
  slug: string
) {
  return apiRequest(`/application/${slug}`, "DELETE", config.apiKey);
}

export async function restoreApplication(
  config: { apiKey: string },
  slug: string
) {
  return apiRequest(`/application/${slug}/restore`, "PUT", config.apiKey);
}

export async function submitApplication(
  config: any,
  title: string,
  categorySlug: string,
  applicationData: any
) {
  const { apiKey, formSlug, applicantSlug } = config;
  const payload = {
    applicant: applicantSlug,
    season: SEASON_SLUG,
    form: formSlug,
    status: "submitted",
    title: title,
    category: categorySlug,
    application_fields: applicationData,
  };
  return apiRequest("/application", "POST", apiKey, payload);
}

export async function addTags(config: any, appSlug: string, tags: string[]) {
  const { apiKey } = config;

  if (!appSlug || !tags || tags.length === 0) {
    throw new Error("Missing application slug or tags.");
  }

  for (const tag of tags) {
    const encodedTag = encodeURIComponent(tag);
    await apiRequest(
      `/application/${appSlug}/tag/${encodedTag}`,
      "PUT",
      apiKey
    );
    await sleep(500);
  }

  return {
    success: true,
    message: `Successfully added all ${tags.length} tags.`,
  };
}
