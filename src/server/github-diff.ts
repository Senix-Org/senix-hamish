import { getInstallationOctokit } from '@/lib/github-app';
   
   export interface ChangedFile {
     filename: string;
     status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
     additions: number;
     deletions: number;
     changes: number;
     patch?: string;          // unified diff hunk, may be missing for binary/large files
     previous_filename?: string;
     contents_url?: string;
   }
   
   /**
    * Fetch the list of files changed in a PR.
    * Paginated — GitHub returns up to 30 per page, max 3000 total.
    */
   export async function fetchPRFiles(
     installationId: number,
     owner: string,
     repo: string,
     prNumber: number
   ): Promise<ChangedFile[]> {
     const octokit = getInstallationOctokit(installationId);
   
     const files: ChangedFile[] = [];
     let page = 1;
     const perPage = 100;
   
     while (true) {
       const { data } = await octokit.request(
         'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
         {
           owner,
           repo,
           pull_number: prNumber,
           per_page: perPage,
           page,
         }
       );
   
       files.push(...(data as ChangedFile[]));
   
       if (data.length < perPage) break;
       if (page > 30) break; // hard cap at 3000 files for safety.
       page += 1;
     }
   
     return files;
   }