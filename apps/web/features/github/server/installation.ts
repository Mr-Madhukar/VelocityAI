export type GitHubInstallationCallback = {
  installationId: string;
  setupAction: string | null;
};

export function parseGitHubInstallationCallback(
  searchParams: URLSearchParams,
): GitHubInstallationCallback | null {
  const installationId = searchParams.get("installation_id");

  if (!installationId) {
    return null;
  }

  return {
    installationId,
    setupAction: searchParams.get("setup_action"),
  };
}
