import { logInfo } from "../lib/logger.js";
import { debugApolloPeopleSearch, fetchApolloPeople, testApolloApiKey } from "../services/apollo.js";

export async function runTestApolloJob() {
  const health = await testApolloApiKey();
  const debugSearch = await debugApolloPeopleSearch();
  const people = await fetchApolloPeople();
  const preview = people.slice(0, 5).map((person) => ({
    company_name: person.company_name,
    buyer_name: person.buyer_name,
    buyer_title: person.buyer_title,
    email: person.email,
    country: person.country,
    industry: person.industry
  }));

  logInfo("Apollo API test succeeded", {
    health,
    debugSearchStatus: debugSearch.status,
    debugSearchSummary: {
      totalEntries:
        debugSearch.response?.pagination?.total_entries ||
        debugSearch.response?.pagination?.total_entries_in_database ||
        null
    },
    fetchedCount: people.length,
    preview
  });
}
