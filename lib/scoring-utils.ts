// shaibalsharif/csv-uploader-include-callforidea/csv-uploader-include-callForIdea-fe61227ec0c792d529ac1bafca0fb8d9e4e0fee4/lib/scoring-utils.ts

export interface RawScoringRow {
  application_id: string;
  application_slug: string; 
  application: string; 
  category: string;
  reviewer_email: string;
  reviewer_first: string;
  reviewer_last: string;
  scoring_criterion: string;
  score: number;
  max_score: number;
  weighted_score: number;
  weighted_max_score: number;
  score_set_name: string; 
  score_set_slug: string;
  applicant_first: string; 
  applicant_last: string; 
  applicant_email: string;
}

export interface AppAggregates {
    id: string;
    application_slug: string; 
    title: string;
    category: string;
    score_set_name: string; 
    score_set_slug: string; 
    applicant_name: string;
    applicant_email: string;
    finalAverage: number | null;
    finalReviewerScores: Record<string, number>;
    criteriaAverages: Record<string, number>;
    reviewers: any; 
    criteria: any;
}

export interface ReviewerAggregates {
    email: string;
    name: string;
    avgReviewerScore: number | null;
    countApps: number;
    appScores: Record<string, number>;
    sumReviewerScores: number;
}

export interface AggregatedData {
    apps: Record<string, AppAggregates>;
    reviewers: Record<string, ReviewerAggregates>;
    summary: {
        totalApps: number;
        totalReviewers: number;
        totalCategories: number;
        totalRecords: number;
        avgRawScore: number;
        avgFinalScore: number | null;
    };
}

const ELIGIBILITY_SET_NAME = "Eligibility Shortlisting";
const ELIGIBILITY_DISPLAY_MAX = 6; 
const DEFAULT_DISPLAY_MAX = 5;


export function parseNum(v: any): number {
    if (v === "" || v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/,/g, "")); 
    return isNaN(n) ? 0 : n;
}

export function normalizeRow(r: Record<string, any>): RawScoringRow {
  const get = (...names: string[]) => {
    for (const n of names) {
      if (r[n] !== undefined && r[n] !== null) return r[n];
    }
    return "";
  };
  
  return {
    application_id:
      "" +
      (
        get("Application ID", "App ID", "application_id", "application id") || ""
      ).toString(),
    application_slug:
        get("Application slug", "Application Slug", "Application_slug", "application_slug") || "",
    application:
      get("Application", "Project Title", "application", "Project") || "",
    category: get("Category", "category") || "",
    reviewer_email: (get("Reviewer email", "Reviewer Email", "Email") || "")
      .toString()
      .toLowerCase(),
    reviewer_first:
      get(
        "Reviewer first name",
        "Reviewer First Name",
        "ReviewerFirst",
        "Reviewer First"
      ) || "",
    reviewer_last: get("Reviewer last name", "Reviewer Last Name") || "",
    scoring_criterion:
      get("Scoring criterion", "Criterion", "Criteria", "Scoring Criterion") ||
      "",
    score: parseNum(get("Score", "score")),
    max_score: parseNum(get("Max score", "Max Score", "max_score")),
    weighted_score: parseNum(
      get("Weighted score", "Weighted Score", "weighted_score")
    ),
    weighted_max_score: parseNum(
      get("Weighted max score", "Weighted Max Score", "weighted_max_score")
    ),
    score_set_name: get("Score set", "Score Set", "score_set") || "", 
    score_set_slug: get("Score set slug", "Score Set Slug", "score_set_slug") || "", 
    applicant_first: get("First name", "First Name") || "",
    applicant_last: get("Last name", "Last Name") || "",
    applicant_email: get("Email", "email") || "", 
  } as RawScoringRow;
}


export function computeAggregates(data: RawScoringRow[]): AggregatedData {
  const apps: Record<string, any> = {}; 
  const reviewers: Record<string, any> = {}; 

  data.forEach((r) => {
    const appId = r.application_id || "—";
    const rev = r.reviewer_email || "unknown";
    const category = r.category || "Uncategorized";
    
    if (!apps[appId]) {
      apps[appId] = {
        id: appId,
        application_slug: r.application_slug || appId,
        title: r.application || "",
        category: category,
        score_set_name: r.score_set_name,
        score_set_slug: r.score_set_slug,
        applicant_name: (r.applicant_first || "") + " " + (r.applicant_last || ""),
        applicant_email: r.applicant_email || "N/A",
        reviewers: {},
        criteria: {},
        rawCategory: category,
      };
    }
    
    if (!apps[appId].reviewers[rev]) {
      apps[appId].reviewers[rev] = {
        sumWeighted: 0,
        sumWeightedMax: 0,
        sumScore: 0, 
        sumMax: 0,   
        criteriaCount: 0,
      };
    }
    const revEntry = apps[appId].reviewers[rev];
    revEntry.sumWeighted += r.weighted_score;
    revEntry.sumWeightedMax += r.weighted_max_score;
    revEntry.sumScore += r.score;
    revEntry.sumMax += r.max_score;
    revEntry.criteriaCount++;

    const critKey = r.scoring_criterion.toString() || "Criterion";
    if (!apps[appId].criteria[critKey]) {
      apps[appId].criteria[critKey] = {
        sumWeighted: 0,
        sumWeightedMax: 0,
        sumScore: 0,
        sumMax: 0,
        count: 0,
      };
    }
    apps[appId].criteria[critKey].sumWeighted += r.weighted_score;
    apps[appId].criteria[critKey].sumWeightedMax += r.weighted_max_score;
    apps[appId].criteria[critKey].sumScore += r.score;
    apps[appId].criteria[critKey].sumMax += r.max_score;
    apps[appId].criteria[critKey].count++;

    if (!reviewers[rev]) {
      reviewers[rev] = {
        email: rev,
        name: (r.reviewer_first || "") + " " + (r.reviewer_last || ""),
        appScores: {},
        sumReviewerScores: 0,
        countApps: 0,
        avgReviewerScore: null,
      };
    }
  });

  Object.values(apps).forEach((app) => {
    const isEligibility = app.score_set_name === ELIGIBILITY_SET_NAME;
    const displayMax = isEligibility ? ELIGIBILITY_DISPLAY_MAX : DEFAULT_DISPLAY_MAX;


    app.finalReviewerScores = {}; 
    Object.entries(app.reviewers).forEach(([rev, val]) => {
      let scoreOutOfMax = 0;

      if (isEligibility) {
        // Eligibility Shortlisting: Use raw scores, normalize to 6.0
        if (val.sumMax > 0) { 
            scoreOutOfMax = (val.sumScore / val.sumMax) * displayMax;
        } else {
             scoreOutOfMax = val.sumScore; 
        }
      } else {
        // Default Logic (Jury Evaluation, Technical, etc.): Use Weighted Scores, normalize to 5.0
        if (val.sumWeightedMax > 0) {
          scoreOutOfMax = (val.sumWeighted / val.sumWeightedMax) * displayMax;
        } else if (val.sumMax > 0) {
          scoreOutOfMax = (val.sumScore / val.sumMax) * displayMax;
        } 
      }
      
      scoreOutOfMax = Math.max(0, Math.min(displayMax, scoreOutOfMax));
      const finalScore = Math.round((scoreOutOfMax + Number.EPSILON) * 100) / 100;
      
      app.finalReviewerScores[rev] = finalScore;
      reviewers[rev].appScores[app.id] = finalScore;
    });
    
    const revScores = Object.values(app.finalReviewerScores);
    app.finalAverage = revScores.length
      ? Math.round(
          (revScores.reduce((s, x) => s + x, 0) / revScores.length +
            Number.EPSILON) *
            100
        ) / 100
      : null;
      
    app.criteriaAverages = {};
    Object.entries(app.criteria).forEach(([crit, cVal]) => {
        let critAvg = 0;
        
        // Criteria score breakdown is ALWAYS normalized against the configured displayMax for that score set
        if (cVal.sumWeightedMax > 0) {
            critAvg = (cVal.sumWeighted / cVal.sumWeightedMax) * displayMax;
        } else if (cVal.sumMax > 0) {
            critAvg = (cVal.sumScore / cVal.sumMax) * displayMax;
        }
        app.criteriaAverages[crit] =
            Math.round((critAvg + Number.EPSILON) * 100) / 100;
    });
  });

  Object.values(reviewers).forEach((r) => {
    const vals = Object.values(r.appScores);
    r.countApps = vals.length;
    r.sumReviewerScores = vals.reduce((s, x) => s + x, 0);
    r.avgReviewerScore = r.countApps
      ? Math.round((r.sumReviewerScores / r.countApps + Number.EPSILON) * 100) /
        100
      : null;
  });
  
  const appFinals = Object.values(apps).map((a) => a.finalAverage).filter((x) => x !== null && x !== undefined) as number[];
  const avgFinal = appFinals.length ? appFinals.reduce((s, x) => s + x, 0) / appFinals.length : null;
  const isEligibilityOverall = data.length > 0 && data[0].score_set_name === ELIGIBILITY_SET_NAME;
  const avgRaw = data.length ? data.reduce((s, d) => isEligibilityOverall ? s + d.score : s + d.weighted_score, 0) / data.length : 0;
  const uniqueCategories = new Set(data.map(d => d.category)).size;
  
  return { 
      apps: apps as Record<string, AppAggregates>, 
      reviewers: reviewers as Record<string, ReviewerAggregates>,
      summary: {
          totalApps: Object.keys(apps).length,
          totalReviewers: Object.keys(reviewers).length,
          totalCategories: uniqueCategories,
          totalRecords: data.length,
          avgRawScore: Math.round((avgRaw + Number.EPSILON) * 100) / 100,
          avgFinalScore: avgFinal !== null ? Math.round((avgFinal + Number.EPSILON) * 100) / 100 : null,
      }
  };
}