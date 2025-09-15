"use server";

const API_VERSION_HEADER = "application/vnd.Creative Force.v2.3+json";
const API_BASE_URL = "https://api.cr4ce.com";
const SEASON_SLUG = "VgbzlaOa";

export async function submitApplication(config: any, title: string, categorySlug: string, applicationData: any) {
  const { apiKey, formSlug, applicantSlug } = config;

  const payload = {
    applicant: applicantSlug,
    season: SEASON_SLUG,
    form: formSlug,
    status: "submitted",
    title: title, // Title is a top-level field
    category: categorySlug, // Category is a top-level field
    application_fields: applicationData,
  };

  const response = await fetch(`${API_BASE_URL}/application`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": API_VERSION_HEADER,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Creative Force API error: ${response.status} - ${errorData}`);
  }

  const result = await response.json();
  return result;
}

export async function addTags(config: any, appSlug: string, tags: string[]) {
  const { apiKey } = config;

  if (!appSlug || !tags || tags.length === 0) {
    throw new Error("Missing application slug or tags.");
  }

  for (const tag of tags) {
    const encodedTag = encodeURIComponent(tag);
    const response = await fetch(`${API_BASE_URL}/application/${appSlug}/tag/${encodedTag}`, {
      method: "PUT",
      headers: {
        "x-api-key": apiKey,
        "Accept": API_VERSION_HEADER,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to add tag "${tag}": ${response.status} - ${errorData}`);
    }
  }

  return { success: true, message: `Successfully added all ${tags.length} tags.` };
}