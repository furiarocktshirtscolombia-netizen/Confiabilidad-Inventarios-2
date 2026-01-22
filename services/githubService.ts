
import { GitHubConfig, FileData } from '../types';

export const getGitHubFile = async (config: GitHubConfig): Promise<FileData | null> => {
  if (!config.token || !config.owner || !config.repo) return null;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
      {
        headers: {
          Authorization: `token ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to fetch file from GitHub');

    const data = await response.json();
    return {
      name: data.name,
      content: data.content, // GitHub returns base64
      sha: data.sha,
      size: data.size,
    };
  } catch (error) {
    console.error('GitHub Get Error:', error);
    throw error;
  }
};

export const pushGitHubFile = async (
  config: GitHubConfig,
  file: FileData
): Promise<string> => {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Automated update from Prompt Maestro Bridge',
          content: file.content,
          sha: file.sha, // Mandatory if updating
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to push to GitHub');
    }

    const data = await response.json();
    return data.content.sha;
  } catch (error) {
    console.error('GitHub Push Error:', error);
    throw error;
  }
};
