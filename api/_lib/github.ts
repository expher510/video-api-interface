import { ApiError } from './errors.js';

export const dispatchGithubWorkflow = async (
  githubRepo: string,
  githubToken: string,
  eventType: string,
  payload: Record<string, unknown>,
) => {
  const response = await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'eg-autonomous-api',
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: payload,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new ApiError(502, 'github_dispatch_failed', `GitHub dispatch failed with status ${response.status}: ${bodyText.slice(0, 200)}`);
  }
};
