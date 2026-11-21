import type { ConsentChoices } from "@workspace/cms-content";

export const consentEvent = "nextract:consent-changed";

const allCategoriesEnabled: ConsentChoices = {
  essential: true,
  functional: true,
  analytics: true,
  marketing: true,
};

export function useConsentChoices() {
  return allCategoriesEnabled;
}
