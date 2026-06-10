import 'dotenv/config';
   import { enqueue, queueStats } from '@features/review-queue/queue';
   import { supabaseAdmin } from '@features/shared/supabase';
   
   async function main() {
     // Find the most recent analysis row that's still queued
     const { data: analysis } = await supabaseAdmin
       .from('analyses')
       .select('id, pull_request_id, commit_sha')
       .eq('status', 'queued')
       .order('created_at', { ascending: false })
       .limit(1)
       .single();
   
     if (!analysis) {
       console.log('No queued analysis found. Push a commit to a test PR first.');
       process.exit(1);
     }
   
     // Look up PR + repo + installation info
     const { data: pr } = await supabaseAdmin
       .from('pull_requests')
       .select('github_pr_number, head_sha, base_sha, repository_id, repositories(full_name, installation_id, installations(github_installation_id, installed_by_user_id))')
       .eq('id', analysis.pull_request_id)
       .single();
   
     if (!pr) {
       console.error('PR row not found');
       process.exit(1);
     }
   
     const repos = pr.repositories as any;
     const [owner, repoName] = repos.full_name.split('/');
   
     const id = await enqueue('analyze-pr', {
       analysisId: analysis.id,
       pullRequestId: analysis.pull_request_id,
       userId: repos.installations.installed_by_user_id,
       installationId: repos.installations.github_installation_id,
       owner,
       repo: repoName,
       prNumber: pr.github_pr_number,
       headSha: pr.head_sha,
       baseSha: pr.base_sha,
     });
   
     const stats = await queueStats();
     console.log(`Enqueued job ${id}. Queue depth:`, stats);
   }
   
   main().catch((e) => { console.error(e); process.exit(1); });