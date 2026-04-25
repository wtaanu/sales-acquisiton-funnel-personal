import axios from "axios";
import { config } from "../config.js";

export async function verifyEmail(email) {
  if (!config.zeroBounceApiKey) {
    return {
      status: "unknown",
      sub_status: "missing_api_key",
      notes: "ZeroBounce API key is not configured."
    };
  }

  const response = await axios.get("https://api.zerobounce.net/v2/validate", {
    params: {
      api_key: config.zeroBounceApiKey,
      email
    }
  });

  return {
    status: response.data.status || "unknown",
    sub_status: response.data.sub_status || "",
    notes: response.data.did_you_mean ? `Did you mean ${response.data.did_you_mean}?` : ""
  };
}

export function normalizeVerification(result) {
  const status = (result.status || "").toLowerCase();
  if (status === "valid") {
    return { verification_status: "approved_for_review", verification_sub_status: "valid" };
  }
  if (status === "catch-all") {
    return { verification_status: "manual_review", verification_sub_status: "catch-all" };
  }
  if (status === "unknown") {
    return { verification_status: "manual_review", verification_sub_status: "unknown" };
  }
  return { verification_status: "rejected", verification_sub_status: status || "unknown" };
}
